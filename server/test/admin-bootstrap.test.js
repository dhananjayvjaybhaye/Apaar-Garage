import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import bcrypt from 'bcrypt';
import { promptForAdmin } from '../scripts/admin-prompt.js';
import { User } from '../src/models/user.js';
import { createOrPromoteAdministrator } from '../src/services/admin-bootstrap.js';
import { shopper, startStore } from './store-fixture.js';

const email = 'first-admin@example.test';
const password = 'console-passphrase-123';
const post = (body, status) => ({ method: 'POST', body, status });

test('admin password and confirmation are hidden from terminal output', async () => {
  const input = new PassThrough();
  input.isTTY = true;
  let transcript = '';
  const output = new Writable({
    write(chunk, _encoding, done) {
      transcript += chunk.toString();
      done();
    },
  });
  output.isTTY = true;
  output.columns = 80;

  const pending = promptForAdmin(input, output);
  input.write('FIRST-ADMIN@EXAMPLE.TEST\r' + password + '\r');
  await setImmediate();
  assert.match(transcript, /Password \(hidden\)/);
  input.write(password + '\r');
  await setImmediate();
  assert.match(transcript, /Confirm password \(hidden\)/);
  input.write(password + '\r');
  assert.deepEqual(await pending, { email, password });
  assert.ok(!transcript.includes(password));
});

test('only the terminal service can create or promote an administrator', async (t) => {
  const origin = await startStore(t);
  const browser = shopper(origin);
  const customer = { email, password: 'ordinary-customer-password', name: 'Existing Customer' };
  await browser('/auth/register', post({ ...customer, role: 'admin' }, 400));
  await browser('/auth/register', post(customer, 201));
  const previous = await User.findOne({ email }).lean();
  assert.equal(previous.role, 'customer');
  for (const path of [
    '/admin/settings',
    '/admin/orders/AG-1234567890ABCD',
    '/admin/products/missing',
    '/admin/support',
    '/admin/coupons',
    '/admin/blocked-contacts',
  ]) {
    await browser(path, { status: 403 });
  }
  await browser('/admin/newsletter/unsubscribe-token', post({ email }, 403));

  await createOrPromoteAdministrator(' FIRST-ADMIN@EXAMPLE.TEST ', password);
  const promoted = await User.findOne({ email }).select('+passwordHash +sessionVersion').lean();
  assert.equal(promoted._id.toString(), previous._id.toString());
  assert.equal(promoted.name, previous.name);
  assert.equal(promoted.role, 'admin');
  assert.equal(promoted.sessionVersion, 1);
  assert.notEqual(promoted.passwordHash, password);
  assert.equal(await bcrypt.compare(password, promoted.passwordHash), true);
  await browser('/admin/settings', { status: 401 });
  await browser('/auth/login', post({ email, password: customer.password }, 401));
  await browser('/auth/login', post({ email, password }));
  await browser('/admin/settings', { status: 401 });
  await browser('/auth/admin/login', post({ email, password }));
  await browser('/admin/settings');

  const freshEmail = 'new-admin@example.test';
  await createOrPromoteAdministrator(freshEmail, password);
  const fresh = shopper(origin);
  await fresh('/auth/admin/login', post({ email: freshEmail, password }));
  await fresh('/admin/settings');
  assert.equal(await User.countDocuments({ role: 'admin' }), 2);
});
