import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { createApp } from '../src/app.js';
import { CartItem } from '../src/models/cart-item.js';
import { Order } from '../src/models/order.js';
import { Product } from '../src/models/product.js';
import { User } from '../src/models/user.js';
import { seedProducts } from '../scripts/products.js';
import { rcSamples } from '../scripts/rc-products.js';

const address = {
  fullName: 'Test Customer',
  phone: '9876543210',
  addressLine1: '10 Test Street',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
};

// Use a dedicated replica set because checkout and cancellation require transactions.
async function startStore(t) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    JWT_SECRET: randomBytes(32).toString('hex'),
    CORS_ORIGINS: 'http://localhost:4200',
    PAYMENT_ONLINE_ENABLED: 'false',
    COD_FEE: '30',
    COD_MIN_ORDER_VALUE: '',
    COD_MAX_ORDER_VALUE: '',
    ORDER_DELIVERY_ESTIMATE: 'Expected in 4–6 business days.',
    DELIVERY_FEE: '',
    FREE_DELIVERY_MIN_ORDER_VALUE: '',
    DELIVERY_PINCODE_RULES: '',
    FIRST_ORDER_DISCOUNT_PERCENT: '0',
    COUPONS_JSON: '[]',
  });
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let server;
  t.after(async () => {
    try {
      if (server?.listening) await new Promise((resolve) => server.close(resolve));
    } finally {
      try {
        await mongoose.disconnect();
      } finally {
        await database.stop();
      }
    }
  });
  await mongoose.connect(database.getUri('store_test'));
  await Promise.all([User.init(), Product.init(), Order.init(), CartItem.init()]);
  await Product.insertMany([...seedProducts.slice(0, 2), rcSamples[0]]);
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

function shopper(origin) {
  const cookies = new Map();
  return async (path, { method = 'GET', body, status = 200 } = {}) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookies.size) headers.Cookie = [...cookies.values()].join('; ');
    const response = await fetch(origin + path, { method, body: JSON.stringify(body), headers });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      cookies.set(pair.split('=', 1)[0], pair);
    }
    const value = response.status === 204 ? undefined : await response.json();
    assert.equal(response.status, status, method + ' ' + path + ' ' + JSON.stringify(value));
    return { value, headers: response.headers };
  };
}

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
    await buyer('/cart/items', { method: 'POST', body: { slug: model.slug, quantity: 2 } });
    const { value: quote } = await buyer('/orders/quote?pincode=' + address.pincode);
    assert.equal(quote.codFeePaise, 3000);
    const checkout = { address, checkoutKey: randomUUID(), quote: quote.quote };
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
});
