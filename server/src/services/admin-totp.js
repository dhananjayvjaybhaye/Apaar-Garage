import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';
import { recoveryCodeCount, totpPeriodSeconds } from '../config/admin-security.js';
import { User } from '../models/user.js';

const cipherName = 'aes-256-gcm';
const issuer = 'Apaar Garage Admin';
const digestRecovery = (code) =>
  createHash('sha256').update(code.toUpperCase().replaceAll('-', '')).digest('hex');

export function encryptTotp(secret, key, user) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(cipherName, key, iv);
  cipher.setAAD(Buffer.from(String(user)));
  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
}

export function decryptTotp(encrypted, key, user) {
  const [iv, tag, body] = encrypted.split('.').map((part) => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv(cipherName, key, iv);
  cipher.setAAD(Buffer.from(String(user)));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8');
}

export function totp(secret, label = '') {
  return new TOTP({
    issuer,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: totpPeriodSeconds,
    secret: Secret.fromBase32(secret),
  });
}

export async function newTotpEnrollment(email) {
  const secret = new Secret({ size: 20 }).base32;
  return { secret, qrCode: await QRCode.toDataURL(totp(secret, email).toString()) };
}

export function verifiedStep(secret, code, timestamp = Date.now()) {
  if (!/^\d{6}$/.test(code ?? '')) return null;
  const offset = totp(secret).validate({ token: code, timestamp, window: 1 });
  return offset === null ? null : Math.floor(timestamp / (1000 * totpPeriodSeconds)) + offset;
}

export function recoveryKit() {
  const codes = Array.from({ length: recoveryCodeCount }, () =>
    randomBytes(12).toString('hex').toUpperCase().match(/.{4}/g).join('-'),
  );
  return { codes, hashes: codes.map(digestRecovery) };
}

export async function verifyAdminTotp(user, rawCode, key, session) {
  const code = rawCode?.trim() ?? '';
  const filter = {
    _id: user._id,
    role: 'admin',
    sessionVersion: user.sessionVersion ?? { $exists: false },
    'adminTotp.encrypted': user.adminTotp.encrypted,
  };
  if (/^(?:[a-f0-9]{4}-){5}[a-f0-9]{4}$|^[a-f0-9]{24}$/i.test(code)) {
    const hash = digestRecovery(code);
    const result = await User.updateOne(
      { ...filter, 'adminTotp.recoveryHashes': hash },
      { $pull: { 'adminTotp.recoveryHashes': hash } },
      { session },
    );
    return result.modifiedCount === 1;
  }
  if (!/^\d{6}$/.test(code)) return false;
  let step;
  try {
    step = verifiedStep(decryptTotp(user.adminTotp.encrypted, key, user._id), code);
  } catch {
    return false;
  }
  if (step === null) return false;
  const result = await User.updateOne(
    { ...filter, 'adminTotp.lastStep': { $lt: step } },
    { $set: { 'adminTotp.lastStep': step } },
    { session },
  );
  return result.modifiedCount === 1;
}
