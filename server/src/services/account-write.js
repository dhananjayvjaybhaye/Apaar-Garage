import { User } from '../models/user.js';
import { HttpError } from '../utils/http-error.js';
import { transaction } from './transaction.js';

export async function lockAccount(user, session) {
  const updated = await User.updateOne(
    { _id: user },
    { $inc: { checkoutVersion: 1 } },
    { session },
  );
  if (!updated.matchedCount) throw new HttpError(401, 'Sign in to continue.');
}

export function writeForAccount(user, action) {
  if (!user) return action(null);
  return transaction(async (session) => {
    await lockAccount(user, session);
    return action(session);
  });
}
