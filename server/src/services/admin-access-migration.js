import { AdminSession } from '../models/admin-security.js';
import { User } from '../models/user.js';
import { AdminAccessError, changeAdminAccess, hasStoreOwner } from './admin-access.js';
import { recordAudit } from './audit.js';

export async function migrateAdminAccess(choose) {
  if (await hasStoreOwner()) return { outcome: 'owner-exists' };
  const candidates = await User.find({ role: 'admin' }).select('email').sort({ email: 1 }).lean();
  if (!candidates.length) return { outcome: 'no-administrators' };
  const selected = candidates.length === 1 ? candidates[0] : await choose(candidates);

  return changeAdminAccess(async (session) => {
    if (await hasStoreOwner(session)) return { outcome: 'owner-exists' };
    const user = await User.findOneAndUpdate(
      { _id: selected._id, role: 'admin', email: selected.email },
      { $set: { adminAccess: 'owner' }, $inc: { sessionVersion: 1 } },
      { session, returnDocument: 'before', runValidators: true },
    )
      .select('email adminAccess')
      .lean();
    if (!user) throw new AdminAccessError('The selected account changed. Run the migration again.');
    await AdminSession.deleteMany({ user: user._id }, { session });
    await recordAudit(
      'admin.access_migrated',
      {
        target: String(user._id),
        before: { adminAccess: user.adminAccess ?? null },
        after: { adminAccess: 'owner', source: 'terminal' },
      },
      session,
    );
    return { outcome: 'promoted', email: user.email };
  });
}
