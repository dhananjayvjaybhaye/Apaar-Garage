import { z } from 'zod';
import { millisecondsPerDay } from './business.js';

export const storeSettingsId = 'store';
export const settingsCacheMs = 30_000;
export const openCodWindowMs = millisecondsPerDay;
export const codRiskDefaults = {
  openPerPhone: 2,
  openPerAddress: 3,
  firstOrderMaxPaise: 250_000,
  confirmationAbovePaise: 400_000,
  undeliveredThreshold: 3,
  undeliveredLookbackDays: 90,
};
export const notificationEvents = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];
export const supportCategories = [
  'order',
  'delivery',
  'return',
  'product',
  'payment',
  'privacy',
  'grievance',
];
export const ticketStatuses = ['open', 'acknowledged', 'resolved', 'closed'];
export const acknowledgementMs = 2 * millisecondsPerDay;
export const resolutionMonths = 1;
export const checkoutPolicyVersion = 'store-policies-v1';
export const resolutionMs = 30 * millisecondsPerDay;
export const consentTextVersion = 'newsletter-v2';
export const accountClosedName = 'Deleted customer';

export function readOrderRetentionDays(env = process.env) {
  return z.coerce
    .number()
    .int()
    .min(1)
    .max(36_525)
    .parse(env.ORDER_RETENTION_DAYS || '2555');
}
