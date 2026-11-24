import { z } from 'zod';
import { consentTextVersion, supportCategories, ticketStatuses } from '../config/store-policy.js';
import { orderNumberPattern } from './order-business-input.js';
import { indianPhone } from './indian-phone.js';

export const contactEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address.'));
const message = z.string().trim().min(1, 'Enter a message.').max(2000);
export const ticketNumberInput = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^AGT-[0-9A-F]{16}$/, 'Enter a valid ticket number.');
export const supportInput = z.strictObject({
  name: z.string().trim().min(1, 'Enter your name.').max(100),
  phone: indianPhone,
  email: contactEmail,
  message,
  category: z.enum(supportCategories),
  orderNumber: z
    .union([z.literal(''), orderNumberPattern])
    .optional()
    .transform((value) => value || undefined),
});
export const lookupInput = z.strictObject({ ticketNumber: ticketNumberInput, email: contactEmail });
export const replyInput = lookupInput.extend({ message });
export const updateSupportInput = z
  .strictObject({
    status: z.enum(ticketStatuses).optional(),
    reply: message.optional(),
  })
  .refine(({ status, reply }) => Boolean(status || reply), 'Provide a status or reply.');
export const newsletterInput = z.strictObject({
  email: contactEmail,
  consent: z.literal(true, 'Choose to receive newsletter updates.'),
  textVersion: z.literal(
    consentTextVersion,
    'Reload the page to review the current newsletter text.',
  ),
  source: z.enum(['home', 'checkout', 'other']),
});
export const unsubscribeTokenInput = z.string().regex(/^[a-f0-9]{64}$/);
