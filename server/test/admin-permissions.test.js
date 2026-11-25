import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'csv-parse/sync';
import { seedProducts } from '../scripts/products.js';
import { AuditLog } from '../src/models/admin-security.js';
import { Product } from '../src/models/product.js';
import { User } from '../src/models/user.js';
import { createOrPromoteAdministrator } from '../src/services/admin-bootstrap.js';
import { address, makeAdmin, shopper, startStore } from './store-fixture.js';

const email = 'collected-contact@example.test';
const credentials = { name: 'Collector', email, password: 'sample-password' };
const post = (body, status = 200) => ({ method: 'POST', body, status });
const [product] = seedProducts;

test('admin permissions and contact disclosures', async (t) => {
  const origin = await startStore(t);
  const owner = await makeAdmin(origin);
  const staff = shopper(origin);
  const staffCredentials = { email: 'staff-permissions@example.test', password: 'sample-password' };
  await createOrPromoteAdministrator(staffCredentials.email, staffCredentials.password, 'staff');
  const { value: session } = await staff('/auth/admin/login', post(staffCredentials));
  assert.ok(session.permissions.includes('orders.work'));
  assert.ok(!session.permissions.includes('orders.export'));

  const buyer = shopper(origin);
  await buyer('/auth/register', post(credentials, 201));
  await buyer('/cart/items', post({ slug: product.slug, quantity: 1 }));
  const { value: { orderNumber } } = await buyer('/orders', post({ acceptPolicies: true, address }, 201));
  const { value: { ticketNumber } } = await buyer('/support', post({
    name: credentials.name, email, phone: address.phone, category: 'order', message: 'Order query', orderNumber,
  }, 201));
  await buyer('/newsletter', post({ email, consent: true, source: 'home', textVersion: 'newsletter-v2' }, 204));
  await Product.updateOne({ slug: product.slug }, { $set: { costPrice: 140 } });

  await t.test('staff are denied restricted endpoints with a valid admin session', async () => {
    const endpoints = {
      GET: ['/admin/customers', '/admin/customers/export', '/admin/orders/export', '/admin/newsletter/export',
        '/admin/coupons', '/admin/blocked-contacts', '/admin/overview/audit', '/admin/users', '/admin/admin-users',
        '/admin/product-imports/template', '/admin/product-imports/export?includeCost=true',
        '/admin/product-imports/capabilities', '/admin/product-imports/history'],
      POST: ['/admin/coupons', '/admin/blocked-contacts', '/admin/newsletter/unsubscribe-token',
        '/admin/users', '/admin/products', '/admin/products/checklist', '/admin/products/' + product.slug + '/duplicate',
        '/admin/media/image', '/admin/media/model', '/admin/product-imports/preview',
        '/admin/product-imports/apply', '/admin/product-imports/prefill', '/admin/product-imports/extract'],
      PUT: ['/admin/settings', '/admin/coupons', '/admin/users'],
      PATCH: ['/admin/products/bulk-status', '/admin/products/' + product.slug,
        '/admin/products/' + product.slug + '/stock', '/admin/users/staff'],
      DELETE: ['/admin/blocked-contacts/012345678901234567890123', '/admin/users/staff'],
    };
    for (const [method, paths] of Object.entries(endpoints)) {
      for (const path of paths) {
        const result = await staff(path, { method, ...(method !== 'GET' && { body: {} }), status: 403 });
        assert.equal(result.value.code, 'ADMIN_FORBIDDEN', method + ' ' + path);
      }
    }
    await staff('/admin/settings');
    await staff('/admin/settings/readiness');
    await staff('/admin/overview/dashboard');
    await staff('/admin/returns');
  });

  await t.test('products cost and list contact fields are redacted without recording a disclosure', async () => {
    for (const [path, field, raw, masked] of [
      ['/admin/orders', 'phone', address.phone, '98•••••210'],
      ['/admin/support', 'email', email, 'c•••@e•••'],
      ['/admin/newsletter', '_id', email, 'c•••@e•••'],
    ]) {
      const list = (await staff(path)).value.items;
      assert.equal(list[0][field], masked);
      assert.ok(!JSON.stringify(list).includes(raw), path);
      assert.equal((await owner(path)).value.items[0][field], raw);
    }
    for (const [path, property] of [
      ['/admin/orders?q=987654', 'items'],
      ['/admin/support?q=collected-contact%40', 'items'],
      ['/admin/newsletter?q=collected-contact%40', 'items'],
    ]) {
      assert.deepEqual((await staff(path)).value[property], []);
      assert.equal((await owner(path)).value[property].length, 1);
    }
    const staffProduct = (await staff('/admin/products/' + product.slug)).value;
    const staffProducts = (await staff('/admin/products?q=' + encodeURIComponent(product.slug))).value.items;
    assert.equal(staffProduct.name, product.name);
    assert.ok(staffProducts.length);
    assert.ok(!Object.hasOwn(staffProduct, 'costPrice'));
    assert.ok(staffProducts.every((item) => !Object.hasOwn(item, 'costPrice')));
    assert.equal((await owner('/admin/products/' + product.slug)).value.costPrice, 140);
    assert.equal((await owner('/admin/products?q=' + encodeURIComponent(product.slug))).value.items[0].costPrice, 140);
    const staffUser = await User.findOne({ email: staffCredentials.email }).select('_id').lean();
    const filter = {
      action: 'privacy.contact_viewed',
      target: { $in: ['orders:list', 'support:list', 'newsletter:list'] },
    };
    assert.equal(await AuditLog.countDocuments({ ...filter, who: staffUser._id }), 0);
    assert.equal(await AuditLog.countDocuments(filter), 6);
  });

  await t.test('single order and ticket contact views and owner exports are audited', async () => {
    const orderPath = '/admin/orders/' + orderNumber;
    const ticketPath = '/admin/support/' + ticketNumber;
    const order = await staff(orderPath);
    assert.equal(order.value.address.phone, address.phone);
    assert.equal(order.headers.get('cache-control'), 'no-store');
    assert.equal((await staff(ticketPath)).value.email, email);
    assert.equal((await staff(orderPath + '/packing-slip')).value.address.addressLine1, address.addressLine1);
    await staff(ticketPath, { method: 'PATCH', body: { reply: 'Acknowledged' } });
    await staff(orderPath + '/notes', post({ note: 'Verified' }, 201));
    for (const [path, expected] of [
      ['/admin/orders/export', address.phone],
      ['/admin/customers/export?q=collected-contact', email],
      ['/admin/newsletter/export', email],
    ]) {
      const csv = (await owner(path, { asText: true })).value;
      const records = parse(csv, { bom: true, columns: true });
      assert.ok(Object.values(records[0]).includes(expected));
    }
    const audit = await AuditLog.find({ action: 'privacy.contact_viewed' }).lean();
    for (const target of [ticketNumber, orderNumber, orderNumber + '/packing-slip',
      'orders:export', 'customers:export', 'newsletter:export']) {
      assert.ok(audit.some((entry) => entry.target === target && entry.who && entry.after.fields.length));
    }
    assert.equal(audit.filter((entry) => entry.target === ticketNumber).length, 2);
    const encoded = JSON.stringify(audit);
    for (const value of [address.phone, address.addressLine1, email]) assert.ok(!encoded.includes(value));
  });
});
