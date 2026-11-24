import { HttpError } from '../utils/http-error.js';

export function requireAdministrator(_req, res, next) {
  if (res.locals.user.role !== 'admin')
    throw new HttpError(403, 'Administrator access is required.');
  next();
}
