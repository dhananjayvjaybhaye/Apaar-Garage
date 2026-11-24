import { z } from 'zod';

export function normalizeIndianPhone(value) {
  return value
    .trim()
    .replace(/[\s()-]/g, '')
    .replace(/^(?:\+?91|0)(?=\d{10}$)/, '');
}

export const indianPhone = z
  .string()
  .max(32)
  .transform(normalizeIndianPhone)
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'));

/**
 * @typedef {object} PhoneVerifier
 * @property {(phone: string) => Promise<string>} start Start a challenge for a normalized phone.
 * @property {(challengeId: string, code: string) => Promise<boolean>} verify Check an OTP.
 */
