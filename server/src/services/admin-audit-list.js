import { auditPageSize } from '../config/admin-security.js';
import { AuditLog } from '../models/admin-security.js';
import { User } from '../models/user.js';

const userId = /^[a-f0-9]{24}$/i;

export async function listAdminAudit() {
  const items = await AuditLog.find()
    .select('-__v')
    .sort({ at: -1, _id: -1 })
    .limit(auditPageSize)
    .lean();
  const ids = new Set(
    items.flatMap(({ who, target, action }) => [
      ...(who ? [String(who)] : []),
      ...(action.startsWith('admin.') && userId.test(target) ? [target] : []),
    ]),
  );
  const people = await User.find({ _id: { $in: [...ids] } })
    .select('name email')
    .lean();
  const names = new Map(people.map(({ _id, name, email }) => [String(_id), name || email]));
  return items.map((entry) => {
    const target = entry.target;
    let targetLabel = target;
    if (entry.action.startsWith('admin.')) {
      if (userId.test(target)) targetLabel = names.get(target) ?? 'Account unavailable';
      else if (target?.startsWith('account:')) targetLabel = 'Sign-in account';
      else if (target?.startsWith('ip:')) targetLabel = 'Network address';
    }
    return {
      ...entry,
      targetLabel,
      actorLabel: entry.who
        ? (names.get(String(entry.who)) ?? 'Account unavailable')
        : entry.after?.source === 'terminal'
          ? 'Terminal'
          : entry.action.startsWith('admin.')
            ? 'Unverified'
            : 'Guest',
    };
  });
}
