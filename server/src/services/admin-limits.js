import { createHmac, randomUUID } from 'node:crypto';
import { ipKeyGenerator } from 'express-rate-limit';
import { adminFailureLimit, adminFailureWindowMs } from '../config/admin-security.js';
import { AdminLoginLimit } from '../models/admin-security.js';
import { recordAudit } from './audit.js';

const identifier = (key, kind, value) =>
  kind + ':' + createHmac('sha256', key).update(value).digest('hex');

const cutoff = (now) => new Date(+now - adminFailureWindowMs);
const windowEnd = (now) => new Date(+now + adminFailureWindowMs);

async function reserve(id, at) {
  // Reserve a slot before bcrypt so simultaneous requests cannot exceed the limit.
  const reservation = { id: randomUUID(), at, failed: false };
  const expired = { $lte: [{ $ifNull: ['$expiresAt', new Date(0)] }, at] };
  const available = {
    $and: [{ $not: ['$locked'] }, { $lt: [{ $size: '$attempts' }, adminFailureLimit] }],
  };
  const update = [
    {
      $set: {
        locked: { $cond: [expired, false, '$locked'] },
        attempts: {
          $cond: [
            expired,
            [],
            {
              $filter: {
                input: { $ifNull: ['$attempts', []] },
                as: 'entry',
                cond: { $gt: ['$$entry.at', cutoff(at)] },
              },
            },
          ],
        },
      },
    },
    {
      $set: {
        attempts: {
          $cond: [available, { $concatArrays: ['$attempts', [reservation]] }, '$attempts'],
        },
        expiresAt: { $cond: [available, windowEnd(at), '$expiresAt'] },
      },
    },
  ];
  const options = { updatePipeline: true, returnDocument: 'after' };
  let row;
  try {
    row = await AdminLoginLimit.findOneAndUpdate({ _id: id }, update, {
      ...options,
      upsert: true,
    }).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    row = await AdminLoginLimit.findOneAndUpdate({ _id: id }, update, options).lean();
  }
  return row?.attempts.some((entry) => entry.id === reservation.id)
    ? { _id: id, 'attempts.id': reservation.id }
    : null;
}

export async function reserveAdminAttempt(key, email, ip) {
  const at = new Date();
  const account = identifier(key, 'account', email);
  const network = identifier(key, 'ip', ipKeyGenerator(ip));
  const reservations = [];
  for (const id of [account, network]) {
    const result = await reserve(id, at);
    if (!result) {
      await releaseReservations(reservations);
      return null;
    }
    reservations.push(result);
  }
  return { account, reservations };
}

export async function releaseReservations(reservations) {
  await Promise.all(
    reservations.map((filter) =>
      AdminLoginLimit.updateOne(filter, { $pull: { attempts: { id: filter['attempts.id'] } } }),
    ),
  );
}

export async function failAdminAttempt(attempt, ip) {
  await recordAudit('admin.sign_in_failed', { target: attempt.account, ip });
  for (const filter of attempt.reservations) {
    const now = new Date();
    await AdminLoginLimit.updateOne(filter, { $set: { 'attempts.$.failed': true } });
    const locked = await AdminLoginLimit.updateOne(
      {
        _id: filter._id,
        locked: false,
        expiresAt: { $gt: now },
        $expr: {
          $gte: [
            {
              $size: {
                $filter: {
                  input: '$attempts',
                  as: 'entry',
                  cond: { $and: ['$$entry.failed', { $gt: ['$$entry.at', cutoff(now)] }] },
                },
              },
            },
            adminFailureLimit,
          ],
        },
      },
      { $set: { locked: true, expiresAt: windowEnd(now) } },
    );
    if (locked.modifiedCount)
      await recordAudit('admin.sign_in_locked', {
        target: filter._id,
        ip,
        after: { minutes: adminFailureWindowMs / 60_000 },
      });
  }
}
