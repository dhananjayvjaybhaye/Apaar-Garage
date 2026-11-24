import { createHash, hkdfSync } from 'node:crypto';

export const adminCookie = 'apaar_admin';
export const adminCsrfHeader = 'X-Admin-CSRF';
export const adminSessionMs = 12 * 60 * 60 * 1000;
export const adminIdleMs = 30 * 60 * 1000;
export const adminSetupMs = 10 * 60 * 1000;
export const adminFailureWindowMs = 15 * 60 * 1000;
export const adminFailureLimit = 5;
export const auditPageSize = 30;
export const totpPeriodSeconds = 30;
export const recoveryCodeCount = 10;
export const adminCookieScope = 'admin';
export const setupCookieScope = 'setup';

function boolean(value, fallback, name) {
  if (!value) return fallback;
  if (!['true', 'false'].includes(value)) throw new Error('Set ' + name + ' to true or false.');
  return value === 'true';
}

export function readAdminSecurity(env, secret, production) {
  const require2fa = boolean(env.ADMIN_REQUIRE_2FA, production, 'ADMIN_REQUIRE_2FA');
  if (production && !require2fa) throw new Error('Production requires ADMIN_REQUIRE_2FA=true.');
  const supplied = env.ADMIN_TOTP_KEY?.trim();
  if (supplied && !/^[a-f0-9]{64}$/i.test(supplied))
    throw new Error('ADMIN_TOTP_KEY must be 32 bytes encoded as 64 hex characters.');
  const encryptionKey = supplied
    ? Buffer.from(supplied, 'hex')
    : Buffer.from(hkdfSync('sha256', secret, '', 'apaar-admin-totp-v1', 32));
  const identifierKey = createHash('sha256')
    .update(secret)
    .update('apaar-admin-identifiers-v1')
    .digest();
  return {
    require2fa,
    encryptionKey,
    identifierKey,
    production,
    trustLoopbackProxy: boolean(
      env.ADMIN_TRUST_LOOPBACK_PROXY,
      false,
      'ADMIN_TRUST_LOOPBACK_PROXY',
    ),
  };
}
