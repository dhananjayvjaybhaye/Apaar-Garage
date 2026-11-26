import bcrypt from 'bcrypt';
import { bcryptRounds, defaultAdministratorName } from '../config/auth.js';
import { AdminSession } from '../models/admin-security.js';
import { User } from '../models/user.js';
import { accountEmail, administratorPassword } from '../utils/auth-input.js';
import { recordAudit } from './audit.js';
import {
  AdminAccessError,
  changeAdminAccess,
  hasStoreOwner,
  protectLastOwner,
} from './admin-access.js';

export async function createOrPromoteAdministrator(
  emailInput,
  passwordInput,
  access,
  { force = false } = {},
) {
  if (access !== undefined && !['owner', 'staff'].includes(access))
    throw new AdminAccessError('Choose owner or staff access.');
  if (force && access !== 'staff')
    throw new AdminAccessError('--force requires --staff on create-admin.');
  const email = accountEmail.parse(emailInput);
  const passwordHash = await bcrypt.hash(administratorPassword.parse(passwordInput), bcryptRounds);
  const write = () =>
    changeAdminAccess(async (session) => {
      if (access === undefined && (await hasStoreOwner(session))) {
        throw new AdminAccessError(
          'A store owner already exists. Choose --owner or --staff explicitly.',
        );
      }
      const previous = await User.findOne({ email })
        .select('role adminAccess')
        .session(session)
        .lean();
      const adminAccess = access ?? 'owner';
      if (adminAccess === 'staff') await protectLastOwner(previous, force, session);
      const update = {
        $set: { role: 'admin', passwordHash, adminAccess },
        $setOnInsert: { name: defaultAdministratorName },
        $inc: { sessionVersion: 1 },
      };
      const user = await User.findOneAndUpdate({ email }, update, {
        upsert: true,
        runValidators: true,
        returnDocument: 'after',
        session,
      })
        .select('_id')
        .lean();
      await AdminSession.deleteMany({ user: user._id }, { session });
      const action =
        previous?.role === 'admin'
          ? previous.adminAccess === adminAccess
            ? 'admin.password_rotated'
            : 'admin.access_changed'
          : previous
            ? 'admin.role_granted'
            : 'admin.created';
      await recordAudit(
        action,
        {
          target: String(user._id),
          before: { role: previous?.role ?? null, adminAccess: previous?.adminAccess },
          after: { role: 'admin', adminAccess, source: 'terminal', ...(force && { forced: true }) },
        },
        session,
      );
    });
  try {
    await write();
  } catch (error) {
    if (error.code !== 11000) throw error;
    // A concurrent public registration may have inserted this email during the upsert.
    await write();
  }
}

export function removeAdministrator(emailInput, { force = false } = {}) {
  const email = accountEmail.parse(emailInput);
  return changeAdminAccess(async (session) => {
    const user = await User.findOne({ email, role: 'admin' })
      .select('role adminAccess')
      .session(session)
      .lean();
    if (!user) return false;
    await protectLastOwner(user, force, session);
    await User.updateOne(
      { _id: user._id },
      { $set: { role: 'customer' }, $unset: { adminTotp: 1, adminAccess: 1 } },
      { session },
    );
    await AdminSession.deleteMany({ user: user._id }, { session });
    await recordAudit(
      'admin.role_removed',
      {
        target: String(user._id),
        before: { role: 'admin', adminAccess: user.adminAccess },
        after: { role: 'customer', source: 'terminal', ...(force && { forced: true }) },
      },
      session,
    );
    return true;
  });
}
