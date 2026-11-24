import { notificationEvents } from '../config/store-policy.js';

/**
 * @typedef {object} MobileNotificationChannel
 * @property {(message: { phone: string, orderNumber: string, event: string }) => Promise<void>} send
 */

/** Prepare durable outbox entries inside the order transaction. Workers deliver after commit. */
export function notify(order, event, { orderEmailEnabled }, at = new Date()) {
  if (!notificationEvents.includes(event)) return null;
  return orderEmailEnabled && order.emailAddress ? { kind: event, nextAttemptAt: at } : null;
}
