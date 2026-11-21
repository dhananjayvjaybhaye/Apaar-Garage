import { z } from 'zod';
import { readDiscountOptions } from '../services/discounts.js';
import { readDeliveryRules } from '../services/delivery.js';

function amount(env, name, fallback) {
  const value = env[name]?.trim();
  if (!value) return fallback;
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(
      name + ' must be a non-negative amount in rupees with up to two decimal places.',
    );
  }
  return Math.round(Number(value) * 100);
}

export function readPaymentOptions(env) {
  const enabled = z
    .enum(['false', 'true'])
    .safeParse(env.PAYMENT_ONLINE_ENABLED?.trim() || 'false');
  if (!enabled.success) throw new Error('PAYMENT_ONLINE_ENABLED must be true or false.');

  const fee = amount(env, 'COD_FEE', 0);
  const minimum = amount(env, 'COD_MIN_ORDER_VALUE', 0);
  const maximum = amount(env, 'COD_MAX_ORDER_VALUE', null);
  if (maximum !== null && maximum < minimum) {
    throw new Error('COD_MAX_ORDER_VALUE must be at least COD_MIN_ORDER_VALUE.');
  }

  return {
    ...readDiscountOptions(env),
    deliveryFee: amount(env, 'DELIVERY_FEE', 0),
    freeDeliveryMinimum: amount(env, 'FREE_DELIVERY_MIN_ORDER_VALUE', null),
    deliveryRules: readDeliveryRules(env.DELIVERY_PINCODE_RULES),
    onlineEnabled: enabled.data === 'true',
    fee,
    minimum,
    maximum,
    deliveryEstimate:
      env.ORDER_DELIVERY_ESTIMATE?.trim() || 'A delivery estimate is pending order confirmation.',
  };
}
