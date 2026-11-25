import { HttpError } from '../utils/http-error.js';
import { hasAdminPermission } from '../config/admin-permissions.js';

export function requirePermission(permission) {
  return (_req, res, next) => {
    if (!hasAdminPermission(res.locals.user, permission))
      throw new HttpError(403, 'You don’t have access to this admin action.', undefined, 'ADMIN_FORBIDDEN');
    next();
  };
}
