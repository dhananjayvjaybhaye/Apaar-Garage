// Validates email and message inputs for the support and newsletter endpoints.
import { z } from 'zod';
import { validate } from '../utils/http-error.js';
import { recordSupportRequest, subscribeToNewsletter } from '../services/customer-contact.js';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address.'));
const newsletterInput = z.strictObject({ email });
const supportInput = z.strictObject({
  email,
  message: z.string().trim().min(1, 'Enter a message.').max(2000),
});

export async function submitSupport(req, res) {
  const request = await recordSupportRequest(validate(supportInput, req.body));
  res.set('Cache-Control', 'no-store').status(201).json({ reference: request.id });
}

export async function subscribe(req, res) {
  const { email } = validate(newsletterInput, req.body);
  await subscribeToNewsletter(email);
  res.sendStatus(204);
}
