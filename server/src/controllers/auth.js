// Validates account requests and writes the existing session cookie and public user DTO.
import { z } from 'zod';
import { credentials, registration } from '../utils/auth-input.js';
import { HttpError, validate } from '../utils/http-error.js';
import { authenticate, registerUser } from '../services/auth.js';

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

const logoutBody = z.strictObject({});

export function createAuthController(session) {
  return {
    async register(req, res) {
      const user = await registerUser(validate(registration, req.body));
      session.start(res, user);
      res.status(201).json(publicUser(user));
    },
    async login(req, res) {
      const user = await authenticate(validate(credentials, req.body));
      session.start(res, user);
      res.json(publicUser(user));
    },
    async me(req, res) {
      const user = await session.findUser(req);
      if (!user && req.query.optional !== 'true') throw new HttpError(401, 'Sign in to continue.');
      res.json(user ? publicUser(user) : null);
    },
    logout(req, res) {
      validate(logoutBody, req.body);
      session.clear(res);
      res.sendStatus(204);
    },
  };
}
