import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { createApp } from '../src/app.js';
import { CartItem } from '../src/models/cart-item.js';
import { Order } from '../src/models/order.js';
import { Product } from '../src/models/product.js';
import { createOrPromoteAdministrator } from '../src/services/admin-bootstrap.js';
import { AdminLoginLimit, AdminSession, AuditLog } from '../src/models/admin-security.js';
import { User } from '../src/models/user.js';
import { seedProducts } from '../scripts/products.js';
import { rcSamples } from '../scripts/rc-products.js';

export const address = {
  fullName: 'Test Customer',
  phone: '9876543210',
  addressLine1: '10 Test Street',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
};

// Use a dedicated replica set because checkout and cancellation require transactions.
export async function startStore(t, environment = {}, appOptions = {}) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    ADMIN_REQUIRE_2FA: 'false',
    PRODUCT_AI_PREFILL: 'false',
    ADMIN_TRUST_LOOPBACK_PROXY: 'false',
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
    GST_REGISTERED: 'false',
    COD_OPEN_PER_PHONE: 'off',
    COD_OPEN_PER_ADDRESS: 'off',
    COD_FIRST_ORDER_MAX: 'off',
    COD_CONFIRM_ABOVE: 'off',
    ...environment,
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
  await Promise.all([
    User.init(),
    Product.init(),
    Order.init(),
    CartItem.init(),
    AdminSession.init(),
    AdminLoginLimit.init(),
    AuditLog.init(),
  ]);
  await Product.insertMany([...seedProducts.slice(0, 2), rcSamples[0]]);
  server = createApp(appOptions).listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

export function shopper(origin) {
  const cookies = new Map();
  let csrfToken;
  return async (
    path,
    { method = 'GET', body, raw, status = 200, headers: extra = {}, sendCsrf = true, asText = false } = {},
  ) => {
    const headers = { ...extra };
    if (csrfToken && sendCsrf && method !== 'GET') headers['X-Admin-CSRF'] = csrfToken;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookies.size) headers.Cookie = [...cookies.values()].join('; ');
    const response = await fetch(origin + path, {
      method,
      body: raw ?? JSON.stringify(body),
      headers,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      cookies.set(pair.split('=', 1)[0], pair);
    }
    const value = response.status === 204 ? undefined : await (asText ? response.text() : response.json());
    if (value?.csrfToken) csrfToken = value.csrfToken;
    const expected = Array.isArray(status) ? status : [status];
    assert.ok(
      expected.includes(response.status),
      method + ' ' + path + ' ' + response.status + ' ' + JSON.stringify(value),
    );
    return { value, headers: response.headers, status: response.status };
  };
}

export async function makeAdmin(origin) {
  const admin = shopper(origin);
  const email = 'admin@example.test';
  const password = 'sample-password';
  await createOrPromoteAdministrator(email, password);
  await admin('/auth/admin/login', { method: 'POST', body: { email, password } });
  return admin;
}
