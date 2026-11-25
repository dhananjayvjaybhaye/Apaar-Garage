import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  adminCookie,
  adminCookieScope,
  adminCsrfHeader,
  adminIdleMs,
  adminSessionMs,
  adminSetupMs,
  setupCookieScope,
} from '../config/admin-security.js';
import { AdminSession } from '../models/admin-security.js';
import { User } from '../models/user.js';
import { HttpError } from '../utils/http-error.js';
import { adminPermission, adminPermissions } from '../config/admin-permissions.js';

const sensitiveMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const digest = (token) => createHash('sha256').update(token).digest();
const randomToken = () => randomBytes(32).toString('base64url');
const expired = () => new HttpError(401, 'Sign in as an administrator to continue.');

export function describeAdmin(user, session) {
  const permissions = adminPermissions(user.adminAccess);
  return {
    name: user.name,
    email: user.email,
    canEditSettings: permissions.includes(adminPermission.settingsWrite),
    permissions,
    csrfToken: session.csrf,
    setupRequired: session.scope === setupCookieScope,
    twoFactorEnabled: Boolean(user.adminTotp?.encrypted),
    expiresAt: session.expiresAt,
    idleUntil: session.idleUntil,
    serverTime: new Date(),
  };
}

export function createAdminSessions(config, customers) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: 'strict',
    path: '/',
  };

  async function read(req, res, { allowSetup = false, renew = false } = {}) {
    const cookie = req.cookies?.[adminCookie];
    if (typeof cookie !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(cookie)) {
      const customer = await customers.findUser(req);
      if (customer && customer.role !== 'admin')
        throw new HttpError(403, 'Administrator access is required.');
      throw expired();
    }
    const at = new Date();
    const filter = {
      _id: digest(cookie).toString('hex'),
      expiresAt: { $gt: at },
      idleUntil: { $gt: at },
    };
    let session = await AdminSession.findOne(filter).select('-pendingTotp').lean();
    if (!session) throw expired();
    const user = await User.findOne({ _id: session.user, role: 'admin' })
      .select('name email role adminAccess +adminTotp +sessionVersion')
      .lean();
    if (!user || (user.sessionVersion ?? 0) !== session.sessionVersion) throw expired();
    if (
      session.scope !== setupCookieScope &&
      (config.require2fa || user.adminTotp?.encrypted) &&
      !session.mfaVerified
    )
      throw expired();
    if (!allowSetup && session.scope !== adminCookieScope)
      throw new HttpError(403, 'Complete authenticator setup to access the admin area.');
    if (!sensitiveMethods.has(req.method)) {
      const header = req.get(adminCsrfHeader);
      if (!header || !timingSafeEqual(digest(header), digest(session.csrf)))
        throw new HttpError(
          403,
          'Admin request verification failed. Refresh and try again.',
          undefined,
          'ADMIN_CSRF_MISMATCH',
        );
    }

    if (renew && session.scope === adminCookieScope) {
      const idleUntil = new Date(Math.min(+session.expiresAt, +at + adminIdleMs));
      session = await AdminSession.findOneAndUpdate(
        filter,
        { $max: { idleUntil } },
        { returnDocument: 'after' },
      )
        .select('-pendingTotp')
        .lean();
      if (!session) throw expired();
    }
    res.locals.user = user;
    res.locals.adminSession = session;
    return { user, session };
  }

  return {
    read,
    requireAdmin: async (req, res, next) => {
      await read(req, res, { renew: true });
      next();
    },
    async issue(user, { setupRequired, mfaVerified }, session) {
      const token = randomToken();
      const issuedAt = new Date();
      const expiresAt = new Date(+issuedAt + (setupRequired ? adminSetupMs : adminSessionMs));
      const [record] = await AdminSession.create(
        [
          {
            _id: digest(token).toString('hex'),
            user: user._id,
            sessionVersion: user.sessionVersion ?? 0,
            scope: setupRequired ? setupCookieScope : adminCookieScope,
            csrf: randomToken(),
            mfaVerified,
            issuedAt,
            expiresAt,
            idleUntil: new Date(Math.min(+expiresAt, +issuedAt + adminIdleMs)),
          },
        ],
        { session },
      );
      return { token, record };
    },
    writeCookie(res, token, record) {
      res.cookie(adminCookie, token, { ...cookieOptions, expires: record.expiresAt });
    },
    async close(res, record) {
      await AdminSession.deleteOne({ _id: record._id });
      res.clearCookie(adminCookie, cookieOptions);
    },
    token: (req) => req.cookies[adminCookie],
  };
}
