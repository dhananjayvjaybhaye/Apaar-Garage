import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'csv-parse/sync';
import { seedProducts } from '../scripts/products.js';
import { AuditLog } from '../src/models/admin-security.js';
import { Product } from '../src/models/product.js';
import { SupportRequest } from '../src/models/support-request.js';
import { address, makeAdmin, shopper, startStore } from './store-fixture.js';

const credentials = { name: 'Directory Customer', email: 'directory@example.test', password: 'sample-password' };
const [product] = seedProducts;
const write = (method, body, status = 200) => ({ method, body, status });
const post = (body, status) => write('POST', body, status);
const patch = (body, status) => write('PATCH', body, status);
const subscriber = (email) => ({ email, source: 'home', textVersion: 'newsletter-v2', consent: true });

test('admin return, support, customer, coupon and contact operations', async (t) => {
  const origin = await startStore(t);
  const admin = await makeAdmin(origin);
  const customer = shopper(origin);
  const visitor = shopper(origin);
  await customer('/auth/register', post(credentials, 201));
  const coupon = { code: 'ADMINTEST', percent: 10, totalLimit: 5, perCustomerLimit: 1, active: true };
  let orderNumber;
  let totalPaise;

  await t.test('coupons can be created and edited without resetting use', async () => {
    const endpoint = '/admin/coupons';
    const created = (await admin(endpoint, post(coupon, 201))).value;
    assert.equal(created.redeemedCount, 0);
    await admin(endpoint, post(coupon, 409));
    await admin(endpoint, post({ ...coupon, code: 'INVALID', amountPaise: 1 }, 400));

    await customer('/cart/items', post({ slug: product.slug, quantity: 3 }));
    ({ value: { orderNumber } } = await customer('/orders', post({ acceptPolicies: true, address, coupon: coupon.code }, 201)));
    const updated = (await admin(endpoint, write('PUT', {
      ...coupon, percent: null, amountPaise: 2500, perCustomerLimit: 2, active: false,
    }))).value;
    assert.equal(updated.active, false);
    assert.equal(updated.percent, null);
    assert.equal(updated.perCustomerLimit, 2);
    assert.equal(updated.redeemedCount, 1);
    assert.equal((await admin(endpoint, write('PUT', { ...coupon, active: true }))).value.active, true);
  });

  await t.test('return queue and detail expose available actions and preserve stock rules', async () => {
    const path = '/admin/orders/' + orderNumber;
    for (const status of ['confirmed', 'packed', 'shipped', 'delivered'])
      await admin(path + '/status', patch({ status }));
    const createReturn = async () =>
      (await customer('/orders/' + orderNumber + '/returns', post({
        reason: 'defective', items: [{ slug: product.slug, quantity: 1 }], note: 'Original request',
      }, 201))).value;
    const [refund, replacement, rejected] = [await createReturn(), await createReturn(), await createReturn()];
    const queue = (await admin('/admin/returns?status=requested&q=' + orderNumber)).value;
    assert.equal(queue.total, 3);
    assert.ok(queue.items.every((entry) => entry.orderNumber === orderNumber));
    const detail = async (id) => (await admin('/admin/returns/' + id)).value;
    const change = (id, body, status) => admin(path + '/returns/' + id, patch(body, status));
    assert.deepEqual((await detail(refund.id)).actions, ['approved', 'rejected']);
    assert.equal((await detail(refund.id)).items[0].name, product.name);
    assert.equal((await detail(refund.id)).notes[0].note, 'Original request');
    await change(rejected.id, { status: 'rejected', note: 'Outside policy' });
    assert.deepEqual((await detail(rejected.id)).actions, []);
    const stock = async () => (await Product.findOne({ slug: product.slug })).stock;
    const before = await stock();
    for (const [id, condition] of [[refund.id, 'resalable'], [replacement.id, 'damaged']]) {
      await change(id, { status: 'approved' });
      await change(id, { status: 'received', items: [{ slug: product.slug, condition }] });
      assert.deepEqual((await detail(id)).actions, ['replaced']);
    }
    assert.equal(await stock(), before + 1);
    await change(replacement.id, { status: 'replaced' });
    assert.equal((await detail(replacement.id)).resolution, 'replacement');
    const paid = await admin(path + '/payment', patch({ paymentStatus: 'collected' }));
    totalPaise = paid.value.totalPaise;
    assert.deepEqual((await detail(refund.id)).actions, ['refunded', 'replaced']);
    await change(refund.id, { status: 'refunded', refundAmountPaise: refund.maximumRefundPaise + 1 }, 409);
    await change(refund.id, { status: 'refunded', refundAmountPaise: refund.maximumRefundPaise });
    assert.equal((await detail(refund.id)).refundAmountPaise, refund.maximumRefundPaise);
  });

  await t.test('customer directory is read-only and totals orders by registered account', async () => {
    const data = (await admin('/admin/customers?q=directory')).value;
    const [entry] = data.items;
    assert.equal(data.total, 1);
    assert.equal(entry.email, credentials.email);
    assert.equal(entry.orderCount, 1);
    assert.equal(entry.orderedPaise, totalPaise);
    assert.equal(entry.collectedPaise, totalPaise);
    assert.ok(!Object.hasOwn(entry, 'passwordHash'));
    await admin('/admin/customers', post({}, 404));
    await customer('/admin/customers', { status: 403 });
  });

  await t.test('support inbox filters deadlines and maintains the conversation and timeline', async () => {
    const { value: created } = await customer('/support', post({
      name: credentials.name, phone: address.phone, email: credentials.email,
      category: 'order', message: 'Original message', orderNumber,
    }, 201));
    await SupportRequest.updateOne({ ticketNumber: created.ticketNumber },
      { $set: { acknowledgeBy: new Date(Date.now() - 60_000), dueAt: new Date(Date.now() - 60_000) } });
    const endpoint = '/admin/support/' + created.ticketNumber;
    for (const deadline of ['acknowledge', 'resolve']) {
      const inbox = (await admin('/admin/support?deadline=' + deadline + '&q=' + orderNumber)).value;
      assert.deepEqual(inbox.items.map((entry) => entry.ticketNumber), [created.ticketNumber]);
    }
    assert.equal((await admin(endpoint)).value.actions.nextStatus, 'acknowledged');
    await admin(endpoint, patch({ status: 'resolved' }, 409));
    await admin(endpoint, patch({ reply: 'Support reply' }));
    await customer('/support/reply', post({ ticketNumber: created.ticketNumber, email: credentials.email, message: 'Follow-up' }));
    await admin(endpoint, patch({ status: 'resolved' }));
    await admin(endpoint, patch({ status: 'closed' }));
    const closed = (await admin(endpoint)).value;
    assert.equal(closed.actions.canReply, false);
    assert.ok(closed.acknowledgedAt && closed.resolvedAt);
    assert.deepEqual(closed.replies.map(({ from }) => from), ['support', 'customer']);
    await admin(endpoint, patch({ reply: 'Does not reopen' }, 409));
    assert.equal(await AuditLog.countDocuments({ action: 'support.ticket_updated', target: created.ticketNumber }), 3);
  });

  await t.test('blocked contact changes validate and audit both reasons', async () => {
    const path = '/admin/blocked-contacts';
    await admin(path, post({ reason: 'No selector' }, 400));
    const { value: block } = await admin(path, post({ phone: '+91 9876543210', reason: 'Repeated failures' }, 201));
    assert.equal(block.phone, '9876543210');
    assert.equal((await admin(path)).value.items[0].reason, 'Repeated failures');
    await admin(path + '/' + block._id, write('DELETE', { reason: ' ' }, 400));
    await admin(path + '/' + block._id, write('DELETE', { reason: 'Customer verified' }, 204));
    assert.equal((await admin(path)).value.total, 0);
    const entry = await AuditLog.findOne({ action: 'contact.unblocked', target: block._id }).lean();
    assert.equal(entry.after.reason, 'Customer verified');
  });

  await t.test('newsletter filters omit tokens and CSV exports only active consent', async () => {
    const path = '/admin/newsletter';
    await customer('/newsletter', post(subscriber(credentials.email), 204));
    const other = 'unsubscribed@example.test';
    await visitor('/newsletter', post(subscriber(other), 204));
    const { value: { token } } = await admin(path + '/unsubscribe-token', post({ email: other }));
    await visitor('/newsletter/unsubscribe/' + token, post(undefined, 204));
    const result = (await admin(path + '?status=all')).value;
    assert.equal(result.total, 2);
    assert.ok(result.items.every((entry) => entry.consent?.textVersion && !entry.tokenHash && !entry.tokenNonce));
    assert.equal((await admin(path + '?status=unsubscribed')).value.items[0]._id, other);
    const csv = await admin(path + '/export', { asText: true });
    assert.match(csv.headers.get('content-disposition'), /newsletter-subscribers\.csv/);
    assert.deepEqual(parse(csv.value, { bom: true, columns: true }).map((entry) => entry.email), [credentials.email]);
    assert.equal(parse((await admin(path + '/export?q=unsubscribed', { asText: true })).value, { bom: true, columns: true }).length, 0);
  });

  await t.test('visitor and customer access remains restricted', async () => {
    for (const path of ['/admin/returns', '/admin/support', '/admin/customers', '/admin/coupons',
      '/admin/blocked-contacts', '/admin/newsletter', '/admin/newsletter/export']) {
      await visitor(path, { status: 401 });
      await customer(path, { status: 403 });
    }
  });
});
