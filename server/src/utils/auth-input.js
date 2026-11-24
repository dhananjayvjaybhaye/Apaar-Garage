import { z } from 'zod';
import {
  administratorPasswordMinimum,
  passwordMaximumBytes,
  registrationPasswordMinimum,
} from '../config/auth.js';

export const accountEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address.'));
const password = z
  .string()
  .min(1, 'Enter your password.')
  .refine(
    (value) => Buffer.byteLength(value) <= passwordMaximumBytes,
    'Password must be ' + passwordMaximumBytes + ' UTF-8 bytes or fewer.',
  );
const minimumLength = (size) =>
  password.refine((value) => value.length >= size, 'Use at least ' + size + ' characters.');

export const credentials = z.strictObject({ email: accountEmail, password });
export const registration = credentials.extend({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  password: minimumLength(registrationPasswordMinimum),
});

export const administratorPassword = minimumLength(administratorPasswordMinimum);
