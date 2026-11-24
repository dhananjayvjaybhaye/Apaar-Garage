import { AuditLog } from '../models/admin-security.js';

export function recordAudit(action, { who, target, before, after, ip } = {}, session = null) {
  return new AuditLog({ action, who, target, before, after, ip }).save({ session });
}

export const adminAudit = (req, res) => ({ who: res.locals.user._id, ip: req.ip });
