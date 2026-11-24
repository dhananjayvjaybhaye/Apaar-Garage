import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { seedProducts } from '../scripts/products.js';
import { Order } from '../src/models/order.js';
import { Product } from '../src/models/product.js';
import { StockMovement } from '../src/models/stock-movement.js';
import { address, makeAdmin, shopper, startStore } from './store-fixture.js';

const [car, otherCar] = seedProducts;
const orderPath = (number) => '/orders/' + number;
const adminPath = (number) => '/admin/orders/' + number;
const productPath = (slug) => '/admin/products/' + slug;
const write = (method, body, status) => ({ method, body, status });
const post = (body, status) => write('POST', body, status);
const patch = (body, status) => write('PATCH', body, status);
const add = (buyer, slug, quantity = 1) => buyer('/cart/items', post({ slug, quantity }));
const place = async (buyer) =>
  (await buyer('/orders', post({ acceptPolicies: true, address }, 201))).value.orderNumber;
const advance = async (admin, number, ...statuses) => {
  for (const status of statuses) await admin(adminPath(number) + '/status', patch({ status }));
};
const stock = async (slug) => (await Product.findOne({ slug }).select('stock').lean()).stock;
const movementCount = (order, reason) => StockMovement.countDocuments({ order, reason });

test('business foundation over the storefront API', async (t) => {
  const origin = await startStore(t, {
    GST_REGISTERED: 'true',
    SELLER_NAME: 'Apaar Test Seller',
    SELLER_ADDRESS: '1 Test Street',
    SELLER_STATE: 'Maharashtra',
    SELLER_GSTIN: '27AAAAA0000A1Z1',
    COUPONS_JSON: '[{"code":"ROUND","amountPaise":101}]',
  });
  const admin = await makeAdmin(origin);
  const newBuyer = () => shopper(origin);

  await t.test('one buyer gets the last unit, and double submission logs one sale', async () => {
    const slug = otherCar.slug;
    await admin(productPath(slug) + '/stock', patch({ delta: 1 - (await stock(slug)) }));
    const buyers = [newBuyer(), newBuyer()];
    await Promise.all(buyers.map((buyer) => add(buyer, slug)));
    const claims = await Promise.all(
      buyers.map((buyer) => buyer('/orders', post({ acceptPolicies: true, address }, [201, 409]))),
    );
    assert.deepEqual(claims.map(({ status }) => status).sort(), [201, 409]);
    assert.equal(await stock(slug), 0);
    const winner = claims.find(({ status }) => status === 201).value.orderNumber;
    assert.equal(await movementCount(winner, 'sale'), 1);
    await admin(productPath(slug) + '/stock', patch({ delta: otherCar.stock }));

    const buyer = newBuyer();
    await add(buyer, car.slug);
    const body = { acceptPolicies: true, address, checkoutKey: randomUUID() };
    const results = await Promise.all([
      buyer('/orders', post(body, [200, 201])),
      buyer('/orders', post(body, [200, 201])),
    ]);
    const number = results[0].value.orderNumber;
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 201]);
    assert.equal(results[1].value.orderNumber, number);
    assert.equal(await movementCount(number, 'sale'), 1);
  });

  await t.test('stale price or MRP is rejected, and hidden items cannot be purchased', async () => {
    const buyer = newBuyer();
    await add(buyer, car.slug);
    for (const productPatch of [{ mrp: car.price + 10 }, { price: car.price + 5 }]) {
      const { value } = await buyer('/orders/quote');
      await admin(productPath(car.slug), patch(productPatch));
      await buyer('/orders', post({ acceptPolicies: true, address, quote: value.quote }, 409));
    }
    const { value } = await buyer('/orders/quote');
    await admin(productPath(car.slug), patch({ status: 'hidden' }));
    await buyer('/orders', post({ acceptPolicies: true, address, quote: value.quote }, 409));
    await buyer('/products/' + car.slug, { status: 404 });
    const unavailable = await buyer('/cart');
    assert.deepEqual(unavailable.value.items, []);
    assert.equal(unavailable.value.unavailableCount, 1);
    assert.equal(
      (await buyer('/cart/unavailable', { method: 'DELETE' })).value.unavailableCount,
      undefined,
    );
    await admin(productPath(car.slug), patch({ status: 'published', gstRatePercent: 18 }));
    await admin(productPath(otherCar.slug), patch({ gstRatePercent: 18 }));
  });

  await t.test(
    'invalid transitions are guarded and customer cancel races safely with pack',
    async () => {
      const buyer = newBuyer();
      await add(buyer, car.slug);
      const number = await place(buyer);
      await admin(adminPath(number) + '/status', patch({ status: 'shipped' }, 409));
      await advance(admin, number, 'confirmed');
      const results = await Promise.all([
        buyer(orderPath(number) + '/cancel', post({ reasonCode: 'changed_mind' }, [200, 409])),
        admin(adminPath(number) + '/status', patch({ status: 'packed' }, [200, 409])),
      ]);
      assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
      const document = await Order.findOne({ number }).lean();
      assert.equal(await movementCount(number, 'cancel'), Number(document.status === 'cancelled'));
      assert.equal(document.statusHistory.length, 2);
      if (document.status === 'cancelled')
        assert.equal(document.cancellation.reasonCode, 'changed_mind');
    },
  );

  await t.test('a refused parcel has its invoice and resalable stock restored once', async () => {
    const buyer = newBuyer();
    await add(buyer, car.slug);
    const number = await place(buyer);
    const before = await stock(car.slug);
    await buyer(orderPath(number) + '/invoice', { status: 404 });
    await advance(admin, number, 'confirmed', 'packed');
    await admin(
      adminPath(number) + '/status',
      patch({
        status: 'shipped',
        shipment: {
          courier: 'Test Courier',
          awb: 'TEST123',
          trackingUrl: 'https://example.test/track',
        },
      }),
    );
    const invoice = (await buyer(orderPath(number) + '/invoice')).value;
    assert.equal(invoice.seller.name, 'Apaar Test Seller');
    assert.equal(invoice.invoiceType, 'tax_invoice');
    assert.equal(invoice.taxBreakup[0].igstPaise, 0);
    assert.equal(invoice.items[0].sku, car.sku);
    assert.equal(invoice.items[0].mrpPaise, (car.price + 10) * 100);
    assert.ok(!JSON.stringify(invoice).includes('costPrice'));
    await newBuyer()(orderPath(number) + '/invoice', { status: 404 });
    await admin(adminPath(number) + '/status', patch({ status: 'cancelled' }, 409));
    await buyer(orderPath(number) + '/cancel', post({}, 409));
    await admin(
      adminPath(number) + '/status',
      patch({ status: 'undelivered', reasonCode: 'refused' }),
    );
    await admin(adminPath(number) + '/status', patch({ status: 'delivered' }, 409));
    const rto = () =>
      admin(
        adminPath(number) + '/status',
        patch({ status: 'returned_to_seller', condition: 'resalable' }),
      );
    await Promise.all([rto(), rto()]);
    assert.equal(await stock(car.slug), before + 1);
    assert.equal(await movementCount(number, 'rto'), 1);
    const order = (await buyer(orderPath(number))).value;
    assert.equal(order.shipment.undeliveredReason, 'refused');
    assert.equal(order.shipment.awb, 'TEST123');
    assert.equal(order.status, 'returned_to_seller');
  });

  await t.test('partial returns honor snapshot, condition and refund cap', async () => {
    const buyer = newBuyer();
    await add(buyer, car.slug, 2);
    await add(buyer, otherCar.slug);
    const { value: quote } = await buyer('/orders/quote?coupon=ROUND');
    assert.ok(quote.taxPaise > 0);
    const {
      value: { orderNumber: number },
    } = await buyer(
      '/orders',
      post({ acceptPolicies: true, address, coupon: 'ROUND', quote: quote.quote }, 201),
    );
    const snapshot = await Order.findOne({ number }).lean();
    assert.equal(snapshot.totalPaise, quote.totalPaise);
    assert.equal(
      snapshot.items.reduce((total, item) => total + item.taxPaise, 0),
      quote.taxPaise,
    );
    assert.equal(snapshot.policyAcceptance.version, 'store-policies-v1');
    assert.ok(snapshot.policyAcceptance.at instanceof Date);
    await advance(admin, number, 'confirmed', 'packed', 'shipped', 'delivered');
    await admin(adminPath(number) + '/payment', patch({ paymentStatus: 'collected' }));
    await admin(productPath(car.slug), patch({ status: 'archived', returnWindowDays: 0 }));
    assert.equal((await buyer(orderPath(number))).value.items[0].quantity, 2);

    const path = orderPath(number) + '/returns';
    const result = await buyer(
      path,
      post({ reason: 'defective', items: [{ slug: car.slug, quantity: 1 }] }, 201),
    );
    const { id, maximumRefundPaise } = result.value;
    await buyer(
      path,
      post({ reason: 'wrong_item', items: [{ slug: car.slug, quantity: 2 }] }, 409),
    );
    const adminReturn = adminPath(number) + '/returns/' + id;
    const before = await stock(car.slug);
    await admin(adminReturn, patch({ status: 'approved' }));
    const receive = () =>
      admin(
        adminReturn,
        patch({ status: 'received', items: [{ slug: car.slug, condition: 'resalable' }] }),
      );
    await Promise.all([receive(), receive()]);
    assert.equal(await stock(car.slug), before + 1);
    assert.equal(await movementCount(number, 'return'), 1);
    assert.ok(maximumRefundPaise < Math.round((car.price + 5) * 100));
    await admin(
      adminReturn,
      patch({ status: 'refunded', refundAmountPaise: maximumRefundPaise + 1 }, 409),
    );
    await admin(adminReturn, patch({ status: 'refunded', refundAmountPaise: maximumRefundPaise }));

    const damaged = await buyer(
      path,
      post({ reason: 'damaged', items: [{ slug: car.slug, quantity: 1 }] }, 201),
    );
    const damagedPath = adminPath(number) + '/returns/' + damaged.value.id;
    await admin(damagedPath, patch({ status: 'approved' }));
    await admin(
      damagedPath,
      patch({ status: 'received', items: [{ slug: car.slug, condition: 'damaged' }] }),
    );
    assert.equal(await stock(car.slug), before + 1);
    assert.equal(await movementCount(number, 'return'), 1);
    const invoice = (await buyer(orderPath(number) + '/invoice')).value;
    const invoiceLine = invoice.items.find(({ slug }) => slug === car.slug);
    assert.equal(
      damaged.value.maximumRefundPaise + maximumRefundPaise,
      invoiceLine.quantity * invoiceLine.unitPricePaise - invoiceLine.discountPaise,
    );
    assert.equal((await buyer(path)).value.items.length, 2);
    await newBuyer()(path, { status: 404 });
    await Order.updateOne(
      { number },
      { $set: { 'shipment.deliveredAt': new Date('2000-01-01Z') } },
    );
    await buyer(
      path,
      post({ reason: 'changed_mind', items: [{ slug: otherCar.slug, quantity: 1 }] }, 409),
    );
  });

  await t.test(
    'concurrent dispatches allocate distinct, consecutive invoices and a single invoice per order',
    async () => {
      const buyers = [newBuyer(), newBuyer(), newBuyer()];
      const numbers = await Promise.all(
        buyers.map(async (buyer) => {
          await add(buyer, otherCar.slug);
          const number = await place(buyer);
          await advance(admin, number, 'confirmed', 'packed');
          return number;
        }),
      );
      await Promise.all(
        [...numbers, numbers[0]].map((number) => advance(admin, number, 'shipped')),
      );
      const invoices = await Order.find({ number: { $in: numbers } }).distinct('invoiceNumber');
      assert.equal(invoices.length, numbers.length);
      const sequences = invoices
        .map((number) => Number(number.split('/').at(-1)))
        .sort((a, b) => a - b);
      assert.equal(sequences[2] - sequences[0], 2);
    },
  );
});
