import { AdminAccessLock } from '../models/admin-security.js';
import { User } from '../models/user.js';
import { transaction } from './transaction.js';

// MongoDB's scalar equality also matches array elements. Access grants must be scalar.
const accessFilter = (access) => ({
  role: 'admin',
  adminAccess: { $eq: access, $not: { $type: 'array' } },
});
const ownerFilter = accessFilter('owner');
export const noOwnerWarning =
  'No store owner found. Run `npm run migrate-admin-access` or `npm run create-admin -- --owner`.';

export class AdminAccessError extends Error {}

export async function hasStoreOwner(session = null) {
  return Boolean(await User.exists(ownerFilter).session(session));
}

export async function hasStaffAccount() {
  return Boolean(await User.exists(accessFilter('staff')));
}

export async function changeAdminAccess(action) {
  const key = { _id: 'store-admin-access' };
  try {
    await AdminAccessLock.updateOne(key, { $setOnInsert: { revision: 0 } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return transaction(async (session) => {
    // Every role change writes the same document before checking ownership.
    await AdminAccessLock.updateOne(key, { $inc: { revision: 1 } }, { session });
    return action(session);
  });
}

export async function protectLastOwner(user, force, session) {
  if (user?.role !== 'admin' || user.adminAccess !== 'owner') return;
  const another = await User.exists({ ...ownerFilter, _id: { $ne: user._id } }).session(session);
  if (!another && !force) {
    throw new AdminAccessError(
      'The last store owner cannot be removed or demoted. Appoint another owner first or pass --force.',
    );
  }
}
