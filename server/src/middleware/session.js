import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { HttpError } from '../utils/http-error.js';
import { User } from '../models/user.js';

const cookieName = 'apaar_session';
const lifetimeSeconds = 8 * 60 * 60;
const issuer = 'apaar-garage';
const audience = 'apaar-garage-store';

export function createSession(secret, secure) {
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
  async function findUser(req) {
    const token = req.cookies[cookieName];
    if (!token) return null;

    let claims;
    try {
      claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience });
    } catch {
      return null;
    }

    if (!mongoose.isObjectIdOrHexString(claims?.sub)) return null;
    const user = await User.findById(claims.sub).select('name email role +sessionVersion').lean();
    if (!user || (user.sessionVersion ?? 0) !== (claims.version ?? 0)) return null;
    return user;
  }

  return {
    findUser,
    start(res, user) {
      const token = jwt.sign({ version: user.sessionVersion ?? 0 }, secret, {
        subject: user._id.toString(),
        algorithm: 'HS256',
        expiresIn: lifetimeSeconds,
        issuer,
        audience,
      });
      res.cookie(cookieName, token, { ...cookieOptions, maxAge: lifetimeSeconds * 1000 });
    },
    clear(res) {
      res.clearCookie(cookieName, cookieOptions);
    },
    async requireUser(req, res, next) {
      const user = await findUser(req);
      if (!user) throw new HttpError(401, 'Sign in to continue.');
      res.locals.user = user;
      next();
    },
  };
}
