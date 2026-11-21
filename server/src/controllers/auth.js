// Validates account requests and writes the existing session cookie and public user DTO.
import { z } from 'zod';
import { HttpError, validate } from '../utils/http-error.js';
import { authenticate, registerUser } from '../services/auth.js';

const credentials = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.')),
  password: z
    .string()
    .min(1, 'Enter your password.')
    .refine((value) => Buffer.byteLength(value) <= 72, 'Password must be 72 UTF-8 bytes or fewer.'),
});
const registration = credentials.extend({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  password: credentials.shape.password.refine(
    (value) => value.length >= 8,
    'Use at least 8 characters.',
  ),
});

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
