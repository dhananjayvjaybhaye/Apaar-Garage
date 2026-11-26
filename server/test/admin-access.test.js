import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminAccessFlags } from '../scripts/admin-access-flags.js';
import { AdminSession, AuditLog } from '../src/models/admin-security.js';
import { User } from '../src/models/user.js';
import { hasStoreOwner, noOwnerWarning } from '../src/services/admin-access.js';
import { migrateAdminAccess } from '../src/services/admin-access-migration.js';
import {
  createOrPromoteAdministrator,
  removeAdministrator,
} from '../src/services/admin-bootstrap.js';
import { shopper, startStore } from './store-fixture.js';

const password = 'test-owner-password';
const first = 'first@example.test';
const second = 'second@example.test';
const refuseSelection = () => assert.fail('No selection should be requested.');
const create = (email, access, options) =>
  createOrPromoteAdministrator(email, password, access, options);

test('terminal access flags reject ambiguous or misplaced force options', () => {
  assert.deepEqual(adminAccessFlags([]), { access: undefined, force: false });
  assert.deepEqual(adminAccessFlags(['--staff', '--force']), { access: 'staff', force: true });
  assert.deepEqual(adminAccessFlags(['--force'], { remove: true }), {
    access: undefined,
    force: true,
  });
  for (const flags of [
    ['--force'],
    ['--owner', '--force'],
    ['--owner', '--staff'],
    ['--staff', '--staff'],
    ['--owne'],
  ])
    assert.throws(() => adminAccessFlags(flags));
  assert.throws(() => adminAccessFlags(['--owner'], { remove: true }));
});

test('migration grants access once, and missing and unknown roles fail closed', async (t) => {
  const origin = await startStore(t);
  assert.deepEqual(await migrateAdminAccess(refuseSelection), { outcome: 'no-administrators' });
  await create(first, 'staff');
  await create(second, 'staff');
  await User.collection.updateOne({ email: first }, { $unset: { adminAccess: '' } });
  await User.collection.updateOne({ email: second }, { $set: { adminAccess: 'unexpected' } });
  const login = async (email) => {
    const client = shopper(origin);
    const { value } = await client('/auth/admin/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(value.hasStaff, false);
    assert.ok(value.permissions.includes('orders.work'));
    assert.ok(!value.permissions.includes('orders.export'));
    await client('/admin/orders/export', { status: 403 });
    return client;
  };
  const original = await login(first);
  await login(second);
  await User.collection.updateOne({ email: first }, { $set: { adminAccess: ['owner', 'staff'] } });
  await login(first);
  assert.equal((await original('/admin/overview/dashboard')).value.ownerWarning, noOwnerWarning);
  assert.equal(await hasStoreOwner(), false);
  await User.collection.updateOne({ email: first }, { $unset: { adminAccess: '' } });
  await assert.rejects(
    migrateAdminAccess(() => {
      throw new Error('Cancelled');
    }),
    /Cancelled/,
  );
  assert.equal(await hasStoreOwner(), false);
  const migrated = await migrateAdminAccess((candidates) => {
    assert.deepEqual(
      candidates.map(({ email }) => email),
      [first, second],
    );
    return candidates[1];
  });
  assert.deepEqual(migrated, { outcome: 'promoted', email: second });
  assert.deepEqual(await migrateAdminAccess(refuseSelection), { outcome: 'owner-exists' });
  const user = await User.findOne({ email: second }).lean();
  assert.equal(user.adminAccess, 'owner');
  assert.equal(await AdminSession.countDocuments({ user: user._id }), 0);
  assert.equal((await User.findOne({ email: first })).adminAccess, undefined);
  assert.equal((await original('/admin/overview/dashboard')).value.ownerWarning, null);
  const audits = await AuditLog.find({ action: 'admin.access_migrated' }).lean();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].target, String(user._id));
  assert.equal(audits[0].before.adminAccess, 'unexpected');
});

test('explicit grants and force rules preserve the last owner under concurrent writes', async (t) => {
  const origin = await startStore(t);
  await create(first);
  assert.equal(await hasStoreOwner(), true);
  await assert.rejects(create(second), /--owner or --staff/);
  await assert.rejects(create(first), /--owner or --staff/);
  await assert.rejects(create(first, 'staff'), /last store owner/);
  await assert.rejects(removeAdministrator(first), /last store owner/);
  const storefront = shopper(origin);
  await storefront('/auth/login', { method: 'POST', body: { email: first, password } });
  await storefront('/account/delete', {
    method: 'POST',
    body: { password, confirm: true },
    status: 409,
  });
  assert.equal(await hasStoreOwner(), true);
  await create(second, 'owner');
  const results = await Promise.allSettled([create(first, 'staff'), removeAdministrator(second)]);
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.match(
    results.find(({ status }) => status === 'rejected').reason.message,
    /last store owner/,
  );
  const remaining = await User.findOne({ role: 'admin', adminAccess: 'owner' }).lean();
  await create(remaining.email, 'staff', { force: true });
  assert.equal(await hasStoreOwner(), false);
  const staff = shopper(origin);
  assert.equal(
    (
      await staff('/auth/admin/login', {
        method: 'POST',
        body: { email: remaining.email, password },
      })
    ).value.hasStaff,
    true,
  );
  assert.equal((await staff('/admin/overview/dashboard')).value.ownerWarning, noOwnerWarning);
  await create(remaining.email, 'owner');
  assert.equal(await removeAdministrator(remaining.email, { force: true }), true);
  assert.equal(await hasStoreOwner(), false);
  const forced = await AuditLog.find({ 'after.forced': true }).lean();
  assert.deepEqual(
    new Set(forced.map(({ action }) => action)),
    new Set(['admin.access_changed', 'admin.role_removed']),
  );
});
