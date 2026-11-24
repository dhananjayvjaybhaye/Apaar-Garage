import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { seedProducts } from '../scripts/products.js';
import { address, makeAdmin, shopper, startStore } from './store-fixture.js';

test('store HTTP contracts', async (t) => {
  const origin = await startStore(t);
  const model = seedProducts[0];
  const credentials = { email: 'buyer@example.test', password: 'sample-password' };
  const buyer = shopper(origin);
  let orderNumber;

  await t.test('products retain pagination, facets, type filters and validation', async () => {
    const { value, headers } = await buyer('/products?productType=diecast&limit=1&facets=true');
    assert.deepEqual([value.page, value.limit, value.total, value.totalPages], [1, 1, 2, 2]);
    assert.equal(value.items[0].slug, model.slug);
    assert.ok(value.facets.brands.includes(model.brand));
    assert.equal(headers.get('cache-control'), 'public, max-age=20');
    const rc = await buyer('/products?category=rc-car&batteryIncluded=true');
    assert.equal(rc.value.items[0].productType, 'rc');
    await buyer('/products?category=rc-car&productType=diecast', { status: 400 });
    const detail = await buyer('/products/' + model.slug);
    assert.equal(detail.value.name, model.name);
    assert.equal(detail.headers.get('cache-control'), 'public, no-cache');
    await buyer('/products/unknown', { status: 404 });
    for (const slug of ['Bad%20Slug', 'a'.repeat(151)]) {
      const invalid = await buyer('/products/' + slug, { status: 400 });
      assert.deepEqual(invalid.value, { message: 'Invalid product slug.' });
      assert.match(invalid.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
    }
  });

  await t.test('registration, session, login and logout retain their contracts', async () => {
    await buyer('/auth/me', { status: 401 });
    assert.equal((await buyer('/auth/me?optional=true')).value, null);
    const registration = await buyer('/auth/register', {
      method: 'POST',
      body: { ...credentials, name: 'Test Customer' },
      status: 201,
    });
    assert.deepEqual(Object.keys(registration.value).sort(), ['email', 'id', 'name']);
    assert.match(registration.headers.getSetCookie()[0], /HttpOnly/i);
    assert.equal(registration.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await buyer('/auth/me')).value, registration.value);
    await buyer('/auth/register', {
      method: 'POST',
      body: { ...credentials, name: 'Duplicate' },
      status: 409,
    });
    await buyer('/auth/logout', { method: 'POST', body: {}, status: 204 });
    await buyer('/auth/me', { status: 401 });
    await buyer('/auth/login', {
      method: 'POST',
      body: { ...credentials, password: 'wrong-password' },
      status: 401,
    });
    assert.deepEqual(
      (await buyer('/auth/login', { method: 'POST', body: credentials })).value,
      registration.value,
    );
  });

  await t.test('cart validates quantity and supports add, update and remove', async () => {
    const guest = shopper(origin);
    const cart = await guest('/cart/items', {
      method: 'POST',
      body: { slug: model.slug, quantity: 1 },
    });
    assert.equal(cart.value.totalQuantity, 1);
    assert.equal(cart.headers.get('cache-control'), 'no-store');
    assert.match(cart.headers.getSetCookie()[0], /HttpOnly/i);
    await guest('/cart/items/' + model.slug, {
      method: 'PATCH',
      body: { quantity: 99 },
      status: 409,
    });
    const updated = await guest('/cart/items/' + model.slug, {
      method: 'PATCH',
      body: { quantity: 2 },
    });
    assert.equal(updated.value.subtotal, model.price * 2);
    const removed = await guest('/cart/items/' + model.slug, { method: 'DELETE' });
    assert.deepEqual(removed.value.items, []);
  });

  await t.test('COD checkout clears the cart and reduces stock exactly once', async () => {
    await shopper(origin)('/orders/quote', { status: 409 });
    assert.deepEqual((await shopper(origin)('/orders/quote?empty=ok')).value, { empty: true });
    await buyer('/cart/items', { method: 'POST', body: { slug: model.slug, quantity: 2 } });
    const { value: quote } = await buyer('/orders/quote?pincode=' + address.pincode);
    assert.equal(quote.codFeePaise, 3000);
    assert.equal(quote.taxPaise, null);
    await buyer('/orders', { method: 'POST', body: { address }, status: 400 });
    const checkout = {
      acceptPolicies: true,
      address,
      checkoutKey: randomUUID(),
      quote: quote.quote,
    };
    await buyer('/orders', {
      method: 'POST',
      body: { ...checkout, paymentMethod: 'online' },
      status: 400,
    });
    const { value } = await buyer('/orders', { method: 'POST', body: checkout, status: 201 });
    orderNumber = value.orderNumber;
    assert.match(orderNumber, /^AG-[0-9A-F]{14}$/);
    assert.deepEqual((await buyer('/orders', { method: 'POST', body: checkout })).value, value);
    assert.equal((await buyer('/cart')).value.totalQuantity, 0);
    assert.equal((await buyer('/products/' + model.slug)).value.stock, model.stock - 2);
    const order = (await buyer('/orders/' + orderNumber)).value;
    assert.equal(order.paymentMethod, 'cod');
    assert.equal(order.paymentStatus, 'pending');
    assert.equal(order.totalPaise, model.price * 200 + 3000);
  });

  await t.test('cancellation restores inventory once and keeps the order history', async () => {
    assert.ok(orderNumber);
    const cancel = '/orders/' + orderNumber + '/cancel';
    const { value } = await buyer(cancel, { method: 'POST', body: {} });
    assert.equal(value.status, 'cancelled');
    assert.equal(value.paymentStatus, 'failed');
    assert.equal(value.canCancel, false);
    assert.deepEqual(
      value.statusHistory.map(({ status }) => status),
      ['placed', 'cancelled'],
    );
    assert.equal((await buyer(cancel, { method: 'POST', body: {} })).value.status, 'cancelled');
    assert.equal((await buyer('/products/' + model.slug)).value.stock, model.stock);
  });

  await t.test('unregistered dispatch issues a bill of supply without tax lines', async () => {
    const admin = await makeAdmin(origin);
    await buyer('/cart/items', { method: 'POST', body: { slug: model.slug, quantity: 1 } });
    const { value } = await buyer('/orders', {
      method: 'POST',
      body: { acceptPolicies: true, address },
      status: 201,
    });
    for (const status of ['confirmed', 'packed', 'shipped']) {
      await admin('/admin/orders/' + value.orderNumber + '/status', {
        method: 'PATCH',
        body: { status },
      });
    }
    const invoice = (await buyer('/orders/' + value.orderNumber + '/invoice')).value;
    assert.equal(invoice.invoiceType, 'bill_of_supply');
    assert.equal(invoice.seller.name, 'Apaar Garage');
    assert.equal(invoice.taxBreakup, undefined);
    assert.equal(invoice.items[0].taxPaise, undefined);
  });
});
