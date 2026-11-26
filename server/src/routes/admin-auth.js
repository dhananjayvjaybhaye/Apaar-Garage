import { Router } from 'express';
import { z } from 'zod';
import { accountEmail, credentials } from '../utils/auth-input.js';
import { HttpError, validate } from '../utils/http-error.js';
import { requestLimit } from '../middleware/http.js';
import { describeAdmin } from '../middleware/admin-session.js';
import { authenticate } from '../services/auth.js';
import { verifyAdminTotp } from '../services/admin-totp.js';
import { beginEnrollment, confirmEnrollment } from '../services/admin-enrollment.js';
import {
  failAdminAttempt,
  releaseReservations,
  reserveAdminAttempt,
} from '../services/admin-limits.js';
import { recordAudit } from '../services/audit.js';
import { transaction } from '../services/transaction.js';

const login = credentials.extend({ code: z.string().trim().max(40).optional() });
const confirm = z.strictObject({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});
const denied = () => new HttpError(401, 'Administrator sign-in failed.');

async function authenticateForAdmin(input) {
  try {
    const user = await authenticate(input, { admin: true });
    return user.role === 'admin' ? user : null;
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return null;
    throw error;
  }
}

export function createAdminAuthRouter(config, sessions) {
  const router = Router();
  router.post('/login', async (req, res) => {
    const parsed = login.safeParse(req.body);
    const email = accountEmail.safeParse(req.body?.email);
    const attempt = await reserveAdminAttempt(
      config.identifierKey,
      email.success ? email.data : '',
      req.ip,
    );
    if (!attempt) {
      throw new HttpError(429, 'Too many sign-in attempts. Wait and try again.');
    }
    let user;
    let result;
    try {
      user = parsed.success ? await authenticateForAdmin(parsed.data) : null;
      result =
        user &&
        (await transaction(async (session) => {
          const mfaVerified = Boolean(user.adminTotp?.encrypted);
          if (
            mfaVerified &&
            !(await verifyAdminTotp(user, parsed.data.code, config.encryptionKey, session))
          )
            return null;
          const setupRequired = config.require2fa && !mfaVerified;
          const issued = await sessions.issue(user, { setupRequired, mfaVerified }, session);
          await recordAudit(
            setupRequired ? 'admin.sign_in_setup_required' : 'admin.sign_in',
            {
              who: user._id,
              target: String(user._id),
              ip: req.ip,
              after: { mfaVerified },
            },
            session,
          );
          return issued;
        }));
    } catch (error) {
      await releaseReservations(attempt.reservations);
      throw error;
    }
    if (!result) {
      await failAdminAttempt(attempt, req.ip);
      throw denied();
    }
    await releaseReservations(attempt.reservations);
    sessions.writeCookie(res, result.token, result.record);
    res.json(await describeAdmin(user, result.record));
  });
  router.get('/session', async (req, res) => {
    const { user, session } = await sessions.read(req, res, { allowSetup: true });
    res.json(await describeAdmin(user, session));
  });
  router.post('/activity', async (req, res) => {
    const { user, session } = await sessions.read(req, res, { renew: true });
    res.json(await describeAdmin(user, session));
  });
  router.post('/logout', async (req, res) => {
    const { session } = await sessions.read(req, res, { allowSetup: true });
    await sessions.close(res, session);
    res.sendStatus(204);
  });
  router.post('/2fa/setup', async (req, res) => {
    const { user, session } = await sessions.read(req, res, { allowSetup: true });
    res.json(await beginEnrollment(user, session, config.encryptionKey));
  });
  router.post(
    '/2fa/confirm',
    requestLimit({
      limit: 5,
      identifier: 'admin-mfa-enroll',
      message: 'Too many setup attempts. Try again later.',
    }),
    async (req, res) => {
      const { code } = validate(confirm, req.body);
      const { user, session } = await sessions.read(req, res, { allowSetup: true });
      const result = await confirmEnrollment(user, session, code, config.encryptionKey, req.ip);
      sessions.writeCookie(res, sessions.token(req), result.session);
      res.json({
        ...(await describeAdmin(result.user, result.session)),
        recoveryCodes: result.recoveryCodes,
      });
    },
  );
  return router;
}
