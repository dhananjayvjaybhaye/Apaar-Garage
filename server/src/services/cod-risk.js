import { createHmac } from 'node:crypto';
import { millisecondsPerDay } from '../config/business.js';
import { openCodWindowMs } from '../config/store-policy.js';
import { BlockedContact, CodLock } from '../models/cod-risk.js';
import { Order } from '../models/order.js';
import { HttpError } from '../utils/http-error.js';

const activeStatuses = ['placed', 'confirmed', 'packed', 'shipped'];
export const blockedMessage =
  'We can’t offer Cash on Delivery for this order. Please contact customer care for help.';

export function privateKey(secret, kind, value) {
  return createHmac('sha256', secret)
    .update(JSON.stringify([kind, value]))
    .digest('hex');
}

function addressKey(address) {
  const street = [address.addressLine1, address.addressLine2 ?? ''].join(' ');
  return [street, address.city, address.state, address.pincode].map((field) =>
    (field ?? '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, ''),
  );
}

export function codIdentity(address, secret) {
  return {
    phoneKey: privateKey(secret, 'cod-phone', address.phone),
    addressKey: privateKey(secret, 'cod-address', addressKey(address)),
  };
}

export async function prepareCodLocks(keys) {
  const expiresAt = new Date(Date.now() + 2 * openCodWindowMs);
  for (const id of Object.values(keys).sort()) {
    try {
      await CodLock.updateOne({ _id: id }, { $set: { expiresAt } }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      await CodLock.updateOne({ _id: id }, { $set: { expiresAt } });
    }
  }
}

export async function holdCodLocks(keys, session) {
  for (const id of Object.values(keys).sort()) {
    await CodLock.updateOne({ _id: id }, { $inc: { version: 1 } }, { session });
  }
}

function phoneFilter(phone, phoneKey) {
  return { $or: [{ 'risk.phoneKey': phoneKey }, { 'address.phone': phone }] };
}

async function checkOpenOrders(input, keys, policy, session, now) {
  const open = {
    paymentMethod: 'cod',
    status: { $in: activeStatuses },
    createdAt: { $gte: new Date(now - openCodWindowMs) },
  };
  if (
    policy.openPerPhone !== null &&
    (await Order.countDocuments({
      ...open,
      ...phoneFilter(input.address.phone, keys.phoneKey),
    }).session(session)) >= policy.openPerPhone
  ) {
    throw new HttpError(
      409,
      'There are already open Cash on Delivery orders for these details. Please try again later or contact customer care.',
    );
  }
  if (policy.openPerAddress === null) return;
  const indexed = await Order.countDocuments({
    ...open,
    'risk.addressKey': keys.addressKey,
  }).session(session);
  if (indexed < policy.openPerAddress) {
    // Older orders have no address key. Compare only recent candidates in the same pincode.
    const candidates = await Order.find({
      ...open,
      'address.pincode': input.address.pincode,
      'risk.addressKey': { $ne: keys.addressKey },
    })
      .select('address')
      .session(session)
      .lean();
    const canonical = JSON.stringify(addressKey(input.address));
    if (
      indexed +
        candidates.filter(({ address }) => JSON.stringify(addressKey(address)) === canonical)
          .length <
      policy.openPerAddress
    )
      return;
  }
  throw new HttpError(
    409,
    'There are already open Cash on Delivery orders for this address. Please try again later or contact customer care.',
  );
}

async function flagRepeatedDelivery(input, keys, policy, session, now) {
  if (policy.undeliveredThreshold === null) return false;
  const failures = await Order.countDocuments({
    ...phoneFilter(input.address.phone, keys.phoneKey),
    paymentMethod: 'cod',
    statusHistory: {
      $elemMatch: {
        status: 'undelivered',
        at: { $gte: new Date(now - policy.undeliveredLookbackDays * millisecondsPerDay) },
      },
    },
  }).session(session);
  if (failures < policy.undeliveredThreshold) return false;
  if (policy.repeatedUndeliveredAction === 'block') throw new HttpError(409, blockedMessage);
  return true;
}

export async function assessCod({ user, input, keys, totalPaise, policy, session }) {
  const { phone, pincode } = input.address;
  if (
    await BlockedContact.exists({
      $or: [
        { phone, pincode: null },
        { phone, pincode },
        { phone: null, pincode },
      ],
    }).session(session)
  )
    throw new HttpError(409, blockedMessage);
  const now = Date.now();
  await checkOpenOrders(input, keys, policy, session, now);
  if (policy.firstOrderMaxPaise !== null && totalPaise > policy.firstOrderMaxPaise) {
    const previous = await Order.exists({
      paymentMethod: 'cod',
      status: 'delivered',
      $or: [{ user }, { 'risk.phoneKey': keys.phoneKey }, { 'address.phone': phone }],
    }).session(session);
    if (!previous)
      throw new HttpError(
        409,
        'Your first Cash on Delivery order is above the available limit. Please reduce the total or contact customer care.',
      );
  }
  const flags = [];
  if (policy.confirmationAbovePaise !== null && totalPaise > policy.confirmationAbovePaise)
    flags.push('high_value');
  if (await flagRepeatedDelivery(input, keys, policy, session, now))
    flags.push('repeated_undelivered');
  return { risk: { ...keys, flags }, needsConfirmation: flags.length > 0 };
}
