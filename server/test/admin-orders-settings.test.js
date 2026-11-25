import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'csv-parse/sync';
import { seedProducts } from '../scripts/products.js';
import { AuditLog } from '../src/models/admin-security.js';
import { Order } from '../src/models/order.js';
import { Product } from '../src/models/product.js';
import { createOrPromoteAdministrator } from '../src/services/admin-bootstrap.js';
import { address, makeAdmin, shopper, startStore } from './store-fixture.js';

const base = '/admin/orders';
const settingsPath = '/admin/settings';
const [product] = seedProducts;
const write = (method, body, status = 200) => ({ method, body, status });
const post = (body, status) => write('POST', body, status);
const patch = (body, status) => write('PATCH', body, status);
const put = (body, status) => write('PUT', body, status);

async function order(origin, shipping = address) {
  const buyer = shopper(origin);
  await buyer('/cart/items', post({ slug: product.slug, quantity: 1 }));
  const { value } = await buyer('/orders', post({ acceptPolicies: true, address: shipping }, 201));
  return base + '/' + value.orderNumber;
}

test('admin Orders and owner Settings workflows', async (t) => {
  const origin = await startStore(t, {
    GST_REGISTERED: 'true',
    SELLER_NAME: 'Apaar Test Seller',
    SELLER_ADDRESS: '1 Test Street',
    SELLER_STATE: 'Maharashtra',
    SELLER_GSTIN: '27AAAAA0000A1Z1',
  });
  const owner = await makeAdmin(origin);
  const staff = shopper(origin);
  const credentials = { email: 'staff@example.test', password: 'sample-password' };
  await createOrPromoteAdministrator(credentials.email, credentials.password, 'staff');
  const session = (await staff('/auth/admin/login', post(credentials))).value;
  assert.equal(session.canEditSettings, false);
  assert.equal((await owner('/auth/admin/session')).value.canEditSettings, true);
  const visitor = shopper(origin);
  const customer = shopper(origin);
  await customer('/auth/register', post({ name: 'Shopper', email: 'buyer@example.test', password: 'sample-password' }, 201));

  await t.test('order search, combined filters, sorting, pagination and safe CSV', async () => {
    const result = await order(origin);
    const number = result.split('/').at(-1);
    const { _id, ...original } = await Order.findOne({ number }).lean();
    const candidates = ['=formula', '+formula', '-formula', '@formula', '  =spaces', 'Comma, "quote"'];
    await Order.insertMany(Array.from({ length: 21 }, (_, index) => ({
      ...original,
      number: 'AG-' + String(index + 1).padStart(14, '0'),
      createdAt: new Date(Date.UTC(2026, 0, 2, 17, 30) + index * 60_000),
      address: { ...address, pincode: '411999', fullName: candidates[index] ?? 'Other Customer' },
      totalPaise: 10_000 + index,
      status: index === 0 ? 'delivered' : 'placed',
      risk: { flags: index === 1 ? ['repeated_undelivered'] : [] },
      needsConfirmation: index === 1,
    })));

    for (const search of [number, 'test customer', '+91 (98765) 43210', '411001']) {
      const { value } = await staff(base + '?q=' + encodeURIComponent(search));
      assert.ok(value.items.some((item) => item.orderNumber === number));
    }
    assert.equal((await staff(base + '?q=' + encodeURIComponent('.*'))).value.total, 0);
    assert.equal((await staff(base + '?from=2026-01-03&to=2026-01-02', { status: 400 })).status, 400);
    const filter = '?q=411999&from=2026-01-02&to=2026-01-02&sort=highest';
    const pages = await Promise.all([staff(base + filter), staff(base + filter + '&page=2')]);
    assert.equal(pages[0].value.totalPages, 2);
    assert.equal(pages[0].value.items.length, 20);
    assert.deepEqual(pages[1].value.items.map((item) => item.totalPaise), [10_000]);
    assert.equal(pages[0].value.items[0].totalPaise, 10_020);
    assert.equal((await staff(base + filter + '&status=delivered&codToCollect=1')).value.total, 1);
    assert.equal((await staff(base + filter + '&flagged=1&needsConfirmation=1')).value.total, 1);
    await staff(base + '/export' + filter, { status: 403 });
    const csv = await owner(base + '/export' + filter + '&page=2', { asText: true });
    assert.match(csv.headers.get('content-disposition'), /orders\.csv/);
    const rows = parse(csv.value, { bom: true, columns: true });
    assert.equal(rows.length, 21);
    for (const input of candidates.slice(0, 5)) assert.ok(rows.some((row) => row.customer === "'" + input));
    assert.ok(rows.some((row) => row.customer === candidates[5]));
    await visitor(base + '/export', { status: 401 });
    await customer(base, { status: 403 });
  });

  await t.test('order actions follow confirmation, fulfillment, documents and payment rules', async () => {
    const path = await order(origin);
    const number = path.split('/').at(-1);
    const originalSettings = (await owner(settingsPath)).value;
    await owner(settingsPath, put({ ...originalSettings, risk: { ...originalSettings.risk, confirmationAbovePaise: 0 } }));
    const { value } = await staff(path);
    assert.equal(value.address.phone, address.phone);
    assert.equal(value.items[0].sku, product.sku);
    assert.ok(Array.isArray(value.taxBreakup));
    assert.deepEqual(value.actions.statuses, ['confirmed', 'cancelled']);
    assert.equal(value.actions.confirmationBlocked, true);
    await staff(path + '/status', patch({ status: 'confirmed' }));
    await staff(path + '/status', patch({ status: 'packed' }, 409));
    for (const status of ['unreachable', 'declined']) {
      await staff(path + '/confirmation', patch({ status }));
      assert.equal((await staff(path)).value.actions.statuses.includes('packed'), false);
    }
    await staff(path + '/notes', post({ note: 'Verified delivery address' }, 201));
    await staff(path + '/confirmation', patch({ status: 'confirmed' }));
    assert.ok((await staff(path)).value.actions.statuses.includes('packed'));
    await staff(path + '/payment', patch({ paymentStatus: 'collected' }, 409));
    await staff(path + '/status', patch({ status: 'packed' }));
    const shipment = { courier: 'Test Courier', awb: 'AWB-123', trackingUrl: 'https://example.test/track' };
    await staff(path + '/status', patch({ status: 'shipped', shipment }));
    assert.equal((await staff(path + '/invoice')).value.invoiceType, 'tax_invoice');
    assert.equal((await staff(path + '/packing-slip')).value.orderNumber, number);
    await customer(path + '/invoice', { status: 403 });
    await staff(path + '/status', patch({ status: 'delivered' }));
    const delivered = (await staff(path)).value;
    assert.equal(delivered.adminNotes[0].note, 'Verified delivery address');
    assert.equal(delivered.shipment.awb, shipment.awb);
    assert.deepEqual(delivered.statusHistory.map((entry) => entry.status), ['placed', 'confirmed', 'packed', 'shipped', 'delivered']);
    assert.equal(delivered.actions.collectCod, true);
    await staff(path + '/payment', patch({ paymentStatus: 'collected' }));
    assert.equal((await staff(path)).value.actions.collectCod, false);
    await owner(settingsPath, put(originalSettings));
  });

  await t.test('cancellation and failed delivery preserve the reason and stock condition', async () => {
    const cancelled = await order(origin);
    await staff(cancelled + '/status', patch({ status: 'cancelled', reasonCode: 'customer_requested', note: 'Duplicate' }));
    assert.equal((await staff(cancelled)).value.cancellation.reasonCode, 'customer_requested');
    assert.deepEqual((await staff(cancelled)).value.actions.statuses, []);
    const stock = async () => (await Product.findOne({ slug: product.slug }).lean()).stock;
    for (const condition of ['resalable', 'damaged']) {
      const path = await order(origin);
      for (const status of ['confirmed', 'packed', 'shipped'])
        await staff(path + '/status', patch({ status }));
      await staff(path + '/status', patch({ status: 'undelivered', reasonCode: 'refused' }));
      assert.deepEqual((await staff(path)).value.actions.statuses, ['returned_to_seller']);
      await staff(path + '/status', patch({ status: 'returned_to_seller' }, 400));
      const before = await stock();
      await staff(path + '/status', patch({ status: 'returned_to_seller', condition }));
      assert.equal((await staff(path)).value.shipment.returnCondition, condition);
      assert.equal(await stock(), before + Number(condition === 'resalable'));
    }
  });

  await t.test('only owners can save; schema errors, large edits, readiness and audit stay in sync', async () => {
    const current = (await owner(settingsPath)).value;
    await staff(settingsPath, put(current, 403));
    await customer(settingsPath, put(current, 403));
    const before = (await staff(settingsPath + '/readiness')).value.blockers;
    assert.ok(before.includes('Customer care phone is missing.'));
    const input = {
      ...current,
      invoicePrefix: 'ag2',
      customerCare: { phone: '+91 9876543210', email: 'care@example.test', hours: '10–18' },
      grievanceOfficer: { name: 'Test Officer', designation: 'Officer', phone: '9876543210', email: 'grievance@example.test', address: '1 Test Street' },
      policyDetails: { ...current.policyDetails, refundTimeline: 'Within 14 days' },
      deliveryFeePaise: 4999,
      serviceablePincodeRules: Array.from({ length: 500 }, (_, index) => ({
        prefix: String(index + 1000), estimate: 'Expected in four days. '.repeat(5).trim(), cod: true,
      })),
    };
    const invalid = (await owner(settingsPath, put({ ...input, codMaxPaise: 1, codMinPaise: 2 }, 400))).value;
    assert.ok(invalid.details.issues.some((issue) => issue.field === 'codMaxPaise'));
    const auditCount = () => AuditLog.countDocuments({ action: 'settings.updated' });
    const entries = await auditCount();
    const saved = (await owner(settingsPath, put(input))).value;
    assert.equal(saved.invoicePrefix, 'AG2');
    assert.equal(saved.customerCare.phone, '9876543210');
    assert.equal(saved.serviceablePincodeRules.length, 500);
    assert.equal(await auditCount(), entries + 1);
    await owner(settingsPath, put(saved));
    assert.equal(await auditCount(), entries + 1);
    assert.ok(!(await staff(settingsPath + '/readiness')).value.blockers.includes('Customer care phone is missing.'));
    assert.equal((await staff(settingsPath)).value.deliveryFeePaise, 4999);
  });
});
