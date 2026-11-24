import { createHash, randomBytes } from 'node:crypto';
import { consentTextVersion } from '../config/store-policy.js';
import { NewsletterSubscriber } from '../models/newsletter-subscriber.js';
import { HttpError } from '../utils/http-error.js';
import { writeForAccount } from './account-write.js';
import { privateKey } from './cod-risk.js';

const digest = (token) => createHash('sha256').update(token).digest('hex');
const subscriberToken = (secret, nonce) => privateKey(secret, 'newsletter-unsubscribe', nonce);

export async function subscribeToNewsletter({ email, source }, account, secret) {
  const at = new Date();
  const tokenNonce = randomBytes(32).toString('hex');
  const tokenHash = digest(subscriberToken(secret, tokenNonce));
  try {
    await writeForAccount(account, (session) =>
      NewsletterSubscriber.updateOne(
        {
          _id: email,
          $or: [{ unsubscribedAt: { $exists: true } }, { consent: { $exists: false } }],
        },
        {
          $set: {
            subscribedAt: at,
            consent: { at, textVersion: consentTextVersion, source },
            tokenNonce,
            tokenHash,
            ...(account && { account }),
          },
          $unset: { unsubscribedAt: 1, ...(!account && { account: 1 }) },
        },
        { upsert: true, session },
      ),
    );
  } catch (error) {
    // The active subscription already owns this email. A repeat signup leaves consent intact.
    if (error.code !== 11000) throw error;
  }
}

export async function getUnsubscribeToken(email, secret) {
  const record = await NewsletterSubscriber.findOne({
    _id: email,
    unsubscribedAt: { $exists: false },
  })
    .select('+tokenNonce +tokenHash')
    .lean();
  if (!record?.tokenNonce) throw new HttpError(404, 'No active subscription token.');
  const token = subscriberToken(secret, record.tokenNonce);
  if (digest(token) !== record.tokenHash) {
    await NewsletterSubscriber.updateOne(
      { _id: email, tokenNonce: record.tokenNonce, unsubscribedAt: { $exists: false } },
      { $set: { tokenHash: digest(token) } },
    );
  }
  return token;
}

export function unsubscribe(token) {
  return NewsletterSubscriber.updateOne(
    { tokenHash: digest(token), unsubscribedAt: { $exists: false } },
    { $set: { unsubscribedAt: new Date() }, $unset: { tokenNonce: 1, tokenHash: 1 } },
  );
}
