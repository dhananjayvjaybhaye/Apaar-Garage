import { z } from 'zod';
import {
  confirmationStatuses,
  maximumOrderNoteLength,
  orderStatuses,
  returnReasons,
  stockConditions,
  undeliveredReasons,
} from '../config/business.js';
import { maxCartQuantity } from './commerce.js';
import { productSlug } from './product-input.js';

export const orderNumberPattern = z.string().regex(/^AG-[0-9A-F]{14}$/, 'Invalid order number.');
export const note = z.string().trim().min(1).max(maximumOrderNoteLength);
const reasonCode = z
  .string()
  .trim()
  .max(60)
  .regex(/^[a-z][a-z0-9_]*$/);
export const cancellationInput = z.strictObject({
  reasonCode: reasonCode.optional(),
  note: note.optional(),
});
export const confirmationInput = z.strictObject({ status: z.enum(confirmationStatuses) });

const shipment = z.strictObject({
  courier: z.string().trim().min(1).max(100).optional(),
  awb: z.string().trim().min(1).max(100).optional(),
  trackingUrl: z
    .url({ protocol: /^https?$/ })
    .max(1000)
    .optional(),
});
export const orderTransition = z
  .strictObject({
    status: z.enum(orderStatuses),
    reasonCode: reasonCode.optional(),
    note: note.optional(),
    condition: z.enum(stockConditions).optional(),
    shipment: shipment.optional(),
  })
  .superRefine((input, context) => {
    if (input.status === 'undelivered' && !undeliveredReasons.includes(input.reasonCode)) {
      context.addIssue({
        code: 'custom',
        path: ['reasonCode'],
        message: 'Choose refused, unreachable or failed_attempts.',
      });
    }
    if (input.status === 'returned_to_seller' && !input.condition) {
      context.addIssue({
        code: 'custom',
        path: ['condition'],
        message: 'Choose resalable or damaged.',
      });
    }
  });

function distinctLines(line) {
  return z
    .array(line)
    .min(1)
    .refine(
      (items) => new Set(items.map(({ slug }) => slug)).size === items.length,
      'Each item must appear once.',
    );
}

export const returnInput = z.strictObject({
  items: distinctLines(
    z.strictObject({ slug: productSlug, quantity: z.int().min(1).max(maxCartQuantity) }),
  ),
  reason: z.enum(returnReasons),
  note: note.optional(),
});
export const returnId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid return ID.');
export const returnTransition = z.discriminatedUnion('status', [
  z.strictObject({ status: z.enum(['approved', 'rejected', 'replaced']), note: note.optional() }),
  z.strictObject({
    status: z.literal('received'),
    note: note.optional(),
    items: distinctLines(z.strictObject({ slug: productSlug, condition: z.enum(stockConditions) })),
  }),
  z.strictObject({
    status: z.literal('refunded'),
    note: note.optional(),
    refundAmountPaise: z.int().positive(),
  }),
]);
