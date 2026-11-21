import { z } from 'zod';
import { HttpError } from '../utils/http-error.js';
import { Order } from '../models/order.js';

const firstOrderCode = 'FIRST_ORDER';
export const couponCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{2,24}$/, 'Enter a valid coupon code.');

const couponRule = z
  .strictObject({
    code: couponCode,
    minimumPaise: z.int().min(0).default(0),
    startsAt: z.iso.datetime({ offset: true }).optional(),
    endsAt: z.iso.datetime({ offset: true }).optional(),
    percent: z.int().min(1).max(100).optional(),
    amountPaise: z.int().positive().optional(),
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
  const rules = z
    .array(couponRule)
    .max(200)
    .parse(JSON.parse(env.COUPONS_JSON?.trim() || '[]'));
  const coupons = new Map(rules.map((rule) => [rule.code, rule]));
  if (coupons.size !== rules.length || coupons.has(firstOrderCode)) {
    throw new Error('Coupon codes must be unique and FIRST_ORDER is reserved.');
  }
  return { firstOrderPercent, coupons };
}

function percentage(subtotal, percent) {
  return Math.floor(subtotal / 100) * percent + Math.floor(((subtotal % 100) * percent) / 100);
}

export async function discountFor({ user, guest, coupon, subtotal, options, session }) {
  if (coupon) {
    const rule = options.coupons.get(coupon);
    const now = Date.now();
    if (
      !rule ||
      (rule.startsAt && now < Date.parse(rule.startsAt)) ||
      (rule.endsAt && now >= Date.parse(rule.endsAt))
    ) {
      throw new HttpError(422, 'This coupon is invalid or has expired.');
    }
    if (subtotal < rule.minimumPaise) {
      const minimum = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
        rule.minimumPaise / 100,
      );
      throw new HttpError(
        422,
        'This coupon requires a merchandise subtotal of at least ' + minimum + '.',
      );
    }
    const discountPaise = Math.min(
      subtotal,
      rule.amountPaise ?? percentage(subtotal, rule.percent),
    );
    return { discountPaise, discountCode: coupon };
  }

  if (!guest && options.firstOrderPercent && !(await Order.exists({ user }).session(session))) {
    const discountPaise = percentage(subtotal, options.firstOrderPercent);
    if (discountPaise > 0) return { discountPaise, discountCode: firstOrderCode };
  }
  return { discountPaise: 0, discountCode: null };
}
