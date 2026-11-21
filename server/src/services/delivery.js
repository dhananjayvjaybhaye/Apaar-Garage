import { z } from 'zod';

export const pincode = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode.');
const rule = z.object({
  prefix: z.string().regex(/^[1-9]\d{0,5}$/),
  estimate: z.string().trim().min(1).max(180),
  cod: z.boolean(),
});

export function readDeliveryRules(value) {
  if (!value?.trim()) return [];
  return z
    .array(rule)
    .parse(JSON.parse(value))
    .sort((a, b) => b.prefix.length - a.prefix.length);
}

export function deliveryFor(options, pin) {
  const selected = pin
    ? options.deliveryRules.find(({ prefix }) => pin.startsWith(prefix))
    : undefined;
  return { estimate: selected?.estimate ?? options.deliveryEstimate, cod: selected?.cod ?? true };
}

export function shippingCost(options, subtotalPaise) {
  if (options.freeDeliveryMinimum !== null && subtotalPaise >= options.freeDeliveryMinimum)
    return 0;
  return options.deliveryFee;
}
