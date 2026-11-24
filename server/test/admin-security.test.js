import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adminSessionMs,
  adminIdleMs,
  readAdminSecurity,
  totpPeriodSeconds,
} from '../src/config/admin-security.js';
import { AdminLoginLimit, AdminSession, AuditLog } from '../src/models/admin-security.js';
import { User } from '../src/models/user.js';
import {
  createOrPromoteAdministrator,
  removeAdministrator,
} from '../src/services/admin-bootstrap.js';
import { totp } from '../src/services/admin-totp.js';
import { shopper, startStore } from './store-fixture.js';

const password = 'terminal-password-123';
const email = 'secured-admin@example.test';
const signin = '/auth/admin/login';
const post = (body, status, extra = {}) => ({ method: 'POST', body, status, ...extra });
const ip = (value) => ({ headers: { 'X-Forwarded-For': '192.0.2.' + value } });

test('production enforces the mandatory 2FA flag', () => {
  assert.equal(readAdminSecurity({}, password, true).require2fa, true);
  assert.throws(
    () => readAdminSecurity({ ADMIN_REQUIRE_2FA: 'false' }, password, true),
    /requires ADMIN_REQUIRE_2FA/,
  );
});

test('admin credentials, per-account and per-IP lockout', async (t) => {
  const origin = await startStore(t, { ADMIN_TRUST_LOOPBACK_PROXY: 'true' });
  const browser = shopper(origin);
  const customerEmail = 'customer@example.test';
  await browser('/auth/register', post({ name: 'Customer', email: customerEmail, password }, 201));
  const customerDenied = await browser(
    signin,
    post({ email: customerEmail, password }, 401, ip(1)),
  );
  const unknownDenied = await browser(
    signin,
    post({ email: 'unknown@example.test', password }, 401, ip(2)),
  );
  assert.deepEqual(customerDenied.value, unknownDenied.value);
  assert.equal(customerDenied.headers.get('cache-control'), 'no-store');
  await browser('/admin/overview/audit', { status: 403 });
  await createOrPromoteAdministrator(email, password);

  for (let attempt = 3; attempt <= 7; attempt++) {
    const bad = await browser(
      signin,
      post({ email, password: 'wrong-password' }, 401, ip(attempt)),
    );
    assert.deepEqual(bad.value, customerDenied.value);
  }
  const locked = await browser(signin, post({ email, password }, 429, ip(8)));
  assert.equal(locked.headers.get('cache-control'), 'no-store');
  assert.equal(await AuditLog.countDocuments({ action: 'admin.sign_in_locked' }), 1);

  for (let attempt = 1; attempt <= 5; attempt++)
    await browser(
      signin,
      post({ email: 'unknown-' + attempt + '@example.test', password }, 401, ip(9)),
    );
  await browser(signin, post({ email: 'another@example.test', password }, 429, ip(9)));
  assert.equal(await AuditLog.countDocuments({ action: 'admin.sign_in_locked' }), 2);
  await AdminLoginLimit.updateMany({ locked: true }, { $set: { expiresAt: new Date(0) } });
  assert.equal(
    (await browser(signin, post({ email, password }, 200, ip(9)))).value.setupRequired,
    false,
  );
});

test('mandatory enrollment, CSRF, one-time factors, idle cutoff and role removal', async (t) => {
  const origin = await startStore(t, { ADMIN_REQUIRE_2FA: 'true' });
  const browser = shopper(origin);
  await createOrPromoteAdministrator(email, password);
  const credentials = { email, password };
  const user = await User.findOne({ email }).lean();
  const first = await browser(signin, post(credentials));
  assert.equal(first.value.setupRequired, true);
  assert.ok(
    first.headers
      .getSetCookie()
      .some((cookie) => /^apaar_admin=/.test(cookie) && cookie.includes('HttpOnly')),
  );
  await browser('/auth/me', { status: 401 });
  await browser('/admin/overview/audit', { status: 403 });
  await browser('/auth/admin/2fa/setup', post({}, 403, { sendCsrf: false }));

  const enrollment = (await browser('/auth/admin/2fa/setup', post({}))).value;
  assert.match(enrollment.qrCode, /^data:image\/png;base64,/);
  const authenticator = totp(enrollment.secret);
  const enabled = await browser(
    '/auth/admin/2fa/confirm',
    post({ code: authenticator.generate() }),
  );
  assert.equal(enabled.value.setupRequired, false);
  assert.equal(enabled.value.twoFactorEnabled, true);
  assert.equal(enabled.value.recoveryCodes.length, 10);
  const protectedUser = await User.findById(user._id).select('+adminTotp').lean();
  assert.notEqual(protectedUser.adminTotp.encrypted, enrollment.secret);
  assert.ok(
    protectedUser.adminTotp.recoveryHashes.every(
      (hash) => !enabled.value.recoveryCodes.includes(hash),
    ),
  );

  const before = await browser('/admin/settings');
  await browser('/admin/settings', {
    method: 'PUT',
    body: before.value,
    sendCsrf: false,
    status: 403,
  });
  await browser('/admin/settings', { method: 'PUT', body: { ...before.value, codFeePaise: 7500 } });
  const entries = (await browser('/admin/overview/audit')).value.items;
  assert.ok(entries.some((entry) => entry.action === 'admin.2fa_enrolled'));
  assert.ok(
    entries.some(
      (entry) =>
        entry.action === 'settings.updated' &&
        entry.before.codFeePaise !== 7500 &&
        entry.after.codFeePaise === 7500 &&
        entry.who === user._id.toString(),
    ),
  );
  assert.ok(!JSON.stringify(entries).includes(enrollment.secret));

  await browser('/auth/admin/logout', post({}, 204));
  await browser(signin, post(credentials, 401));
  const nextCode = authenticator.generate({ timestamp: Date.now() + totpPeriodSeconds * 1000 });
  await browser(signin, post({ ...credentials, code: nextCode }));
  await browser('/auth/admin/logout', post({}, 204));
  await browser(signin, post({ ...credentials, code: nextCode }, 401));
  const recovery = enabled.value.recoveryCodes[0];
  await browser(signin, post({ ...credentials, code: recovery }));
  await browser('/auth/admin/logout', post({}, 204));
  await browser(signin, post({ ...credentials, code: recovery }, 401));
  await browser(signin, post({ ...credentials, code: enabled.value.recoveryCodes[1] }));
  const current = await AdminSession.findOne({ user: user._id }).lean();
  assert.equal(+current.expiresAt - +current.issuedAt, adminSessionMs);
  assert.ok(+current.idleUntil - +current.issuedAt <= adminIdleMs);
  const idleSoon = new Date(Date.now() + 60_000);
  await AdminSession.updateOne({ _id: current._id }, { $set: { idleUntil: idleSoon } });
  const passive = (await browser('/auth/admin/session')).value;
  assert.equal(+new Date(passive.idleUntil), +idleSoon);
  const renewed = (await browser('/auth/admin/activity', post({}))).value;
  assert.ok(+new Date(renewed.idleUntil) > +idleSoon);
  await AdminSession.updateOne({ _id: current._id }, { $set: { idleUntil: new Date(0) } });
  await browser('/admin/settings', { status: 401 });

  const customer = shopper(origin);
  await customer('/auth/login', post(credentials));
  await browser(signin, post({ ...credentials, code: enabled.value.recoveryCodes[2] }));
  assert.equal(await removeAdministrator(email), true);
  await browser('/admin/settings', { status: 401 });
  await customer('/auth/me');
  await customer('/admin/settings', { status: 403 });
  assert.equal(await AdminSession.countDocuments({ user: user._id }), 0);
  assert.equal(
    await AuditLog.countDocuments({ action: 'admin.role_removed', target: user._id.toString() }),
    1,
  );
});
