import {
  adminCookieScope,
  adminIdleMs,
  adminSessionMs,
  setupCookieScope,
} from '../config/admin-security.js';
import { AdminSession } from '../models/admin-security.js';
import { User } from '../models/user.js';
import { HttpError } from '../utils/http-error.js';
import { recordAudit } from './audit.js';
import {
  decryptTotp,
  encryptTotp,
  newTotpEnrollment,
  recoveryKit,
  verifiedStep,
} from './admin-totp.js';
import { transaction } from './transaction.js';

export async function beginEnrollment(user, session, key) {
  if (user.adminTotp?.encrypted) throw new HttpError(409, 'An authenticator is already enrolled.');
  const enrollment = await newTotpEnrollment(user.email);
  const result = await AdminSession.updateOne(
    { _id: session._id, expiresAt: { $gt: new Date() } },
    { $set: { pendingTotp: encryptTotp(enrollment.secret, key, user._id) } },
  );
  if (!result.matchedCount) throw new HttpError(401, 'The admin setup session ended.');
  return enrollment;
}

export function confirmEnrollment(user, current, code, key, ip) {
  return transaction(async (session) => {
    const at = new Date();
    const record = await AdminSession.findOne({
      _id: current._id,
      expiresAt: { $gt: at },
      idleUntil: { $gt: at },
    })
      .session(session)
      .lean();
    if (!record?.pendingTotp) throw new HttpError(409, 'Start authenticator setup first.');
    const step = verifiedStep(decryptTotp(record.pendingTotp, key, user._id), code, +at);
    if (step === null) throw new HttpError(400, 'Enter a current code from your authenticator.');
    const recovery = recoveryKit();
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        role: 'admin',
        sessionVersion: user.sessionVersion ?? { $exists: false },
        'adminTotp.encrypted': { $exists: false },
      },
      {
        $set: {
          adminTotp: {
            encrypted: record.pendingTotp,
            lastStep: step,
            recoveryHashes: recovery.hashes,
          },
        },
      },
      { session, returnDocument: 'after' },
    )
      .select('name email adminAccess +adminTotp')
      .lean();
    if (!updated) throw new HttpError(409, 'Account security changed. Sign in again.');
    const expiresAt =
      record.scope === setupCookieScope
        ? new Date(+record.issuedAt + adminSessionMs)
        : record.expiresAt;
    const upgraded = await AdminSession.findByIdAndUpdate(
      record._id,
      {
        $set: {
          scope: adminCookieScope,
          mfaVerified: true,
          expiresAt,
          idleUntil: new Date(Math.min(+expiresAt, +at + adminIdleMs)),
        },
        $unset: { pendingTotp: 1 },
      },
      { session, returnDocument: 'after' },
    ).lean();
    await recordAudit(
      'admin.2fa_enrolled',
      {
        who: user._id,
        target: String(user._id),
        ip,
        before: { twoFactorEnabled: false },
        after: { twoFactorEnabled: true },
      },
      session,
    );
    return { user: updated, session: upgraded, recoveryCodes: recovery.codes };
  });
}
