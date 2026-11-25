import { adminPermission, hasAdminPermission } from '../config/admin-permissions.js';
import { adminAudit, recordAudit } from './audit.js';

export function canViewFullContactLists(res) {
  return hasAdminPermission(res.locals.user, adminPermission.fullContactLists);
}

export function maskPhone(phone) {
  if (!phone) return phone;
  if (!/^\d{10}$/.test(phone)) return '•••••';
  return phone.slice(0, 2) + '•••••' + phone.slice(-3);
}

export function maskEmail(email) {
  if (!email) return email;
  const [name, domain] = email.split('@');
  return name && domain ? name[0] + '•••@' + domain[0] + '•••' : '•••';
}

export function auditContactView(req, res, target, fields, count) {
  return recordContactView(adminAudit(req, res), target, fields, count);
}

export function ticketContactFields(ticket) {
  return [...(ticket.email ? ['email'] : []), ...(ticket.phone ? ['phone'] : [])];
}

export function recordContactView(audit, target, fields, count, session) {
  if (!fields.length || count === 0) return;
  return recordAudit('privacy.contact_viewed', {
    ...audit,
    target,
    after: { fields, ...(count !== undefined && { count }) },
  }, session);
}
