import { z } from 'zod';
import { HttpError } from '../utils/http-error.js';
import { Order } from '../models/order.js';
import { Coupon, CouponRedemption } from '../models/coupon.js';
import { paisePerRupee } from '../utils/commerce.js';

const firstOrderCode = 'FIRST_ORDER';
export const couponCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{2,24}$/, 'Enter a valid coupon code.');

export const couponRule = z
  .strictObject({
    code: couponCode.refine((code) => code !== firstOrderCode, 'FIRST_ORDER is reserved.'),
    minimumPaise: z.int().nonnegative().default(0),
    startsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    percent: z.int().min(1).max(100).nullable().optional(),
    amountPaise: z.int().positive().nullable().optional(),
    totalLimit: z.int().positive().nullable().optional(),
    perCustomerLimit: z.int().positive().nullable().optional(),
    active: z.boolean().default(true),
  })
  .refine(
    ({ percent, amountPaise }) => Boolean(percent) !== Boolean(amountPaise),
    'Set exactly one of percent or amountPaise.',
  )
  .refine(
    ({ startsAt, endsAt }) => !startsAt || !endsAt || Date.parse(startsAt) < Date.parse(endsAt),
    'Coupon end time must be after its start time.',
  );

export function readDiscountOptions(env) {
  const firstOrderPercent = z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .parse(env.FIRST_ORDER_DISCOUNT_PERCENT?.trim() || '5');
  const couponDefaults = z
    .array(couponRule)
    .max(200)
    .parse(JSON.parse(env.COUPONS_JSON?.trim() || '[]'));
  if (new Set(couponDefaults.map(({ code }) => code)).size !== couponDefaults.length)
    throw new Error('Coupon codes must be unique.');
  return { firstOrderPercent, couponDefaults };
}

function couponValues({ code: _code, ...value }) {
  return {
    percent: null,
    amountPaise: null,
    startsAt: null,
    endsAt: null,
    totalLimit: null,
    perCustomerLimit: null,
    ...value,
  };
}

export function createCouponInitializer(defaults) {
  let ready;
  return function initialize() {
    ready ??= Promise.all(
      defaults.map(async (rule) => {
        try {
          await Coupon.updateOne(
            { _id: rule.code },
            { $setOnInsert: couponValues(rule) },
            { upsert: true, timestamps: false },
          );
        } catch (error) {
          if (error.code !== 11000) throw error;
        }
      }),
    ).catch((error) => {
      ready = undefined;
      throw error;
    });
    return ready;
  };
}

export function saveCoupon(rule) {
  return Coupon.findOneAndUpdate(
    { _id: rule.code },
    { $set: couponValues(rule) },
    { upsert: true, returnDocument: 'after' },
  ).lean();
}

function percentage(subtotal, percent) {
  return Number((BigInt(subtotal) * BigInt(percent)) / 100n);
}

const unavailableCoupon = () =>
  new HttpError(422, 'This coupon is invalid, expired or has reached its usage limit.');

async function couponDiscount({ coupon, customerKey, accountKey, subtotal, session }) {
  const rule = await Coupon.findById(coupon).session(session).lean();
  const now = Date.now();
  if (
    !rule?.active ||
    (rule.startsAt && now < +rule.startsAt) ||
    (rule.endsAt && now >= +rule.endsAt) ||
    (rule.totalLimit != null && rule.redeemedCount >= rule.totalLimit)
  )
    throw unavailableCoupon();
  const identities = [
    ...(customerKey ? [{ customerKey }] : []),
    ...(accountKey ? [{ accountKey }] : []),
  ];
  if (
    identities.length &&
    rule.perCustomerLimit != null &&
    (await CouponRedemption.countDocuments({ coupon, $or: identities }).session(session)) >=
      rule.perCustomerLimit
  )
    throw unavailableCoupon();
  if (subtotal < rule.minimumPaise) {
    const minimum = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      rule.minimumPaise / paisePerRupee,
    );
    throw new HttpError(
      422,
      'This coupon requires a merchandise subtotal of at least ' + minimum + '.',
    );
  }
  return {
    discountPaise: Math.min(subtotal, rule.amountPaise ?? percentage(subtotal, rule.percent)),
    discountCode: coupon,
  };
}

export async function redeemCoupon({ coupon, customerKey, accountKey, orderNumber, session }) {
  if (!coupon) return;
  // Every redemption writes the same coupon, serializing the usage checks with concurrent checkouts.
  if (
    !(
      await Coupon.updateOne(
        { _id: coupon, active: true },
        { $inc: { redeemedCount: 1 } },
        { session },
      )
    ).matchedCount
  )
    throw unavailableCoupon();
  await CouponRedemption.create([{ coupon, customerKey, accountKey, orderNumber }], { session });
}

export async function discountFor(input) {
  const { user, guest, coupon, subtotal, options, session } = input;
  if (coupon) return couponDiscount(input);
  if (!guest && options.firstOrderPercent && !(await Order.exists({ user }).session(session))) {
    const discountPaise = percentage(subtotal, options.firstOrderPercent);
    if (discountPaise > 0) return { discountPaise, discountCode: firstOrderCode };
  }
  return { discountPaise: 0, discountCode: null };
}
