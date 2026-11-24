import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedProducts } from '../scripts/products.js';
import { millisecondsPerDay } from '../src/config/business.js';
import { CouponRedemption } from '../src/models/coupon.js';
import { Order } from '../src/models/order.js';
import { address, makeAdmin, shopper, startStore } from './store-fixture.js';

const [product] = seedProducts;
const post = (body, status) => ({ method: 'POST', body, status });
const put = (body, status) => ({ method: 'PUT', body, status });
const patch = (body, status) => ({ method: 'PATCH', body, status });
const orderPath = (number) => '/admin/orders/' + number;
const signedIn = {
  email: 'coupon-user@example.test',
  name: 'Coupon Buyer',
  password: 'sample-password',
};

async function prepareBuyer(origin) {
  const buyer = shopper(origin);
  await buyer('/cart/items', post({ slug: product.slug, quantity: 1 }));
  return buyer;
}
function submit(buyer, nextAddress, expected, coupon) {
  return buyer(
    '/orders',
    post(
      { acceptPolicies: true, address: nextAddress, coupon, email: 'receipt@example.test' },
      expected,
    ),
  );
}
async function progress(admin, number, ...steps) {
  for (const step of steps)
    await admin(
      orderPath(number) + '/status',
      patch(typeof step === 'string' ? { status: step } : step),
    );
}

test('store settings, COD controls and coupon redemptions', async (t) => {
  const origin = await startStore(
    t,
    { FIRST_ORDER_DISCOUNT_PERCENT: '10' },
    { orderEmailEnabled: true },
  );
  const admin = await makeAdmin(origin);
  const settings = (await admin('/admin/settings')).value;
  const configure = (risk, additional = {}) =>
    admin(
      '/admin/settings',
      put({
        ...settings,
        ...additional,
        risk: { ...settings.risk, ...risk },
      }),
    );

  await t.test('settings validate writes and expose public fields only', async () => {
    const visitor = shopper(origin);
    await visitor('/admin/settings', { status: 401 });
    await admin('/admin/settings', put({ ...settings, codMaxPaise: 1, codMinPaise: 2 }, 400));
    await configure(
      {},
      {
        invoicePrefix: 'AGX',
        deliveryFeePaise: 7700,
        serviceablePincodeRules: [
          { prefix: '411', estimate: 'Within four days', cod: true },
          { prefix: '411009', estimate: 'Delivery unavailable', cod: false, serviceable: false },
        ],
      },
    );
    const { value } = await visitor('/api/store-info');
    assert.equal(value.deliveryFeePaise, 7700);
    assert.equal(value.seller.legalName, null);
    assert.deepEqual(value.complaints, { acknowledgementHours: 48, resolutionMonths: 1 });
    for (const internal of ['risk', 'invoicePrefix', 'firstOrderDiscountPercent'])
      assert.ok(!Object.hasOwn(value, internal));
    assert.deepEqual((await visitor('/delivery?pincode=411001')).value, {
      estimate: 'Within four days',
      cod: true,
    });
    assert.equal((await visitor('/delivery?pincode=411009')).value.cod, false);
  });

  await t.test(
    'phone limit normalizes mobile numbers and checks concurrent orders within 24 hours',
    async () => {
      await configure({ openPerPhone: 1 });
      const [a, b] = await Promise.all([prepareBuyer(origin), prepareBuyer(origin)]);
      const results = await Promise.all([
        submit(a, { ...address, phone: '+91 (98765) 43210' }, [201, 409]),
        submit(b, { ...address, addressLine1: '11 Test Street' }, [201, 409]),
      ]);
      assert.deepEqual(results.map(({ status }) => status).sort(), [201, 409]);
      const winner = results.find(({ status }) => status === 201).value.orderNumber;
      const order = await Order.findOne({ number: winner }).lean();
      assert.equal(order.address.phone, address.phone);
      await Order.updateOne(
        { number: winner },
        { $set: { createdAt: new Date(Date.now() - (25 * millisecondsPerDay) / 24) } },
        { timestamps: false, overwriteImmutable: true },
      );
      const loser = results[0].status === 409 ? a : b;
      await submit(loser, address, 201);
      await submit(await prepareBuyer(origin), { ...address, phone: '1234567890' }, 400);
    },
  );

  await t.test(
    'address limit catches spelling format and cannot be bypassed with another phone',
    async () => {
      await configure({ openPerAddress: 1 });
      await submit(
        await prepareBuyer(origin),
        {
          ...address,
          phone: '8765432101',
          addressLine1: '77, Ridge-Road',
          addressLine2: 'Unit 4',
        },
        201,
      );
      const result = await submit(
        await prepareBuyer(origin),
        {
          ...address,
          phone: '8765432102',
          addressLine1: '77 ridge road unit 4',
          city: 'PUNE',
        },
        409,
      );
      assert.match(result.value.message, /for this address/);
    },
  );

  await t.test('blocked contacts and first-order COD limits have polite errors', async () => {
    await configure({ firstOrderMaxPaise: 1 });
    const phone = '8765432130';
    const buyer = await prepareBuyer(origin);
    assert.match(
      (await submit(buyer, { ...address, phone }, 409)).value.message,
      /first Cash on Delivery/,
    );
    const block = await admin(
      '/admin/blocked-contacts',
      post({ phone: '+91 ' + phone, reason: 'Test block' }, 201),
    );
    assert.match(
      (await submit(buyer, { ...address, phone }, 409)).value.message,
      /contact customer care/,
    );
    await admin('/admin/blocked-contacts/' + block.value._id, { method: 'DELETE', status: 204 });
  });

  await t.test(
    'repeated failures flag or block the phone, and flagged orders wait for confirmation',
    async () => {
      await configure({ undeliveredThreshold: 1, repeatedUndeliveredAction: 'flag' });
      const shipping = { ...address, phone: '8765432140' };
      const original = (await submit(await prepareBuyer(origin), shipping, 201)).value.orderNumber;
      await progress(admin, original, 'confirmed', 'packed', 'shipped', {
        status: 'undelivered',
        reasonCode: 'refused',
      });
      const flagged = (await submit(await prepareBuyer(origin), shipping, 201)).value.orderNumber;
      const detail = (await admin(orderPath(flagged))).value;
      assert.equal(detail.needsConfirmation, true);
      assert.deepEqual(detail.risk.flags, ['repeated_undelivered']);
      await progress(admin, flagged, 'confirmed');
      await admin(orderPath(flagged) + '/status', patch({ status: 'packed' }, 409));
      await admin(orderPath(flagged) + '/confirmation', patch({ status: 'confirmed' }));
      await progress(admin, flagged, 'packed', 'shipped', 'delivered');
      assert.deepEqual(
        (await Order.findOne({ number: flagged }).lean()).emailEvents.map(({ kind }) => kind),
        ['placed', 'confirmed', 'shipped', 'delivered'],
      );
      await configure({ undeliveredThreshold: 1, repeatedUndeliveredAction: 'block' });
      await submit(await prepareBuyer(origin), shipping, 409);

      await configure({ confirmationAbovePaise: 1 }, { invoicePrefix: 'AGX' });
      const high = (
        await submit(await prepareBuyer(origin), { ...address, phone: '8765432141' }, 201)
      ).value.orderNumber;
      const highDetail = (await admin(orderPath(high))).value;
      assert.deepEqual(highDetail.risk.flags, ['high_value']);
      await progress(admin, high, 'confirmed');
      await admin(orderPath(high) + '/status', patch({ status: 'packed' }, 409));
      await admin(orderPath(high) + '/confirmation', patch({ status: 'confirmed' }));
      await progress(admin, high, 'packed', 'shipped');
      assert.match((await admin(orderPath(high))).value.invoiceNumber, /^AGX\//);
    },
  );

  await t.test(
    'concurrent coupon usage obeys both limits and checkout rounds in paise',
    async () => {
      await configure(
        {},
        { freeDeliveryThresholdPaise: Math.round(product.price * 100), deliveryFeePaise: 7700 },
      );
      await admin('/admin/coupons', put({ code: 'ONE', percent: 7, totalLimit: 1 }));
      await admin(
        '/admin/coupons',
        put({ code: 'PERPHONE', amountPaise: 100_000_000, perCustomerLimit: 1 }),
      );
      for (const [code, phones] of [
        ['ONE', ['8765432151', '8765432152']],
        ['PERPHONE', ['8765432154', '8765432154']],
      ]) {
        const users = await Promise.all(phones.map(() => prepareBuyer(origin)));
        const results = await Promise.all(
          users.map((buyer, index) =>
            submit(buyer, { ...address, phone: phones[index] }, [201, 422], code),
          ),
        );
        assert.deepEqual(results.map(({ status }) => status).sort(), [201, 422]);
        assert.equal(await CouponRedemption.countDocuments({ coupon: code }), 1);
        const winner = await Order.findOne({
          number: results.find(({ status }) => status === 201).value.orderNumber,
        }).lean();
        assert.equal(winner.shippingPaise, 7700);
        if (code === 'ONE')
          assert.equal(winner.discountPaise, Math.floor(winner.subtotalPaise * 0.07));
        else {
          assert.equal(winner.subtotalPaise - winner.discountPaise, 0);
          assert.equal(winner.totalPaise, winner.shippingPaise + winner.codFeePaise);
        }
      }

      await admin('/admin/coupons', put({ code: 'SMALL', amountPaise: 1 }));
      const signed = shopper(origin);
      await signed('/auth/register', post(signedIn, 201));
      await signed('/cart/items', post({ slug: product.slug, quantity: 1 }));
      assert.equal((await signed('/orders/quote')).value.discountCode, 'FIRST_ORDER');
      const withCoupon = (await signed('/orders/quote?coupon=SMALL')).value;
      assert.equal(withCoupon.discountPaise, 1);
      assert.equal(withCoupon.discountCode, 'SMALL');
    },
  );
});
