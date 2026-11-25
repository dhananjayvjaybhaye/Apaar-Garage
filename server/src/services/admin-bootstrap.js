import bcrypt from 'bcrypt';
import { bcryptRounds, defaultAdministratorName } from '../config/auth.js';
import { AdminSession } from '../models/admin-security.js';
import { User } from '../models/user.js';
import { accountEmail, administratorPassword } from '../utils/auth-input.js';
import { recordAudit } from './audit.js';
import { transaction } from './transaction.js';

export async function createOrPromoteAdministrator(emailInput, passwordInput, access) {
  if (access !== undefined && !['owner', 'staff'].includes(access))
    throw new Error('Choose owner or staff access.');
  const email = accountEmail.parse(emailInput);
  const passwordHash = await bcrypt.hash(administratorPassword.parse(passwordInput), bcryptRounds);
  const write = () =>
    transaction(async (session) => {
      const previous = await User.findOne({ email }).select('role adminAccess').session(session).lean();
      const adminAccess =
        access ?? (previous?.role === 'admin' ? previous.adminAccess ?? 'staff' : 'owner');
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
          ? 'admin.password_rotated'
          : previous
            ? 'admin.role_granted'
            : 'admin.created';
      await recordAudit(
        action,
        {
          target: String(user._id),
          before: { role: previous?.role ?? null, adminAccess: previous?.adminAccess },
          after: { role: 'admin', adminAccess, source: 'terminal' },
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

export function removeAdministrator(emailInput) {
  const email = accountEmail.parse(emailInput);
  return transaction(async (session) => {
    const user = await User.findOneAndUpdate(
      { email, role: 'admin' },
      { $set: { role: 'customer' }, $unset: { adminTotp: 1, adminAccess: 1 } },
      { session },
    )
      .select('_id')
      .lean();
    if (!user) return false;
    await AdminSession.deleteMany({ user: user._id }, { session });
    await recordAudit(
      'admin.role_removed',
      {
        target: String(user._id),
        before: { role: 'admin' },
        after: { role: 'customer', source: 'terminal' },
      },
      session,
    );
    return true;
  });
}
