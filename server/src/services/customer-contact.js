// Records support requests and idempotent newsletter subscriptions.
import { NewsletterSubscriber } from '../models/newsletter-subscriber.js';
import { SupportRequest } from '../models/support-request.js';

export function recordSupportRequest(input) {
  return SupportRequest.create(input);
}

export function subscribeToNewsletter(email) {
  return NewsletterSubscriber.updateOne(
    { _id: email },
    { $setOnInsert: { subscribedAt: new Date() } },
    { upsert: true },
  );
}
