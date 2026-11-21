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

    let subject;
    try {
      subject = jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience }).sub;
    } catch {
      return null;
    }

    return mongoose.isObjectIdOrHexString(subject)
      ? User.findById(subject).select('name email role').lean()
      : null;
  }

  return {
    findUser,
    start(res, user) {
      const token = jwt.sign({}, secret, {
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
