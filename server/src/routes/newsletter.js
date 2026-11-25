import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { noStore, requestLimit } from '../middleware/http.js';
import { requirePermission } from '../middleware/administrator.js';
import { adminPermission as p } from '../config/admin-permissions.js';
import { subscribeToNewsletter, getUnsubscribeToken, unsubscribe } from '../services/newsletter.js';
import { contactEmail, newsletterInput, unsubscribeTokenInput } from '../utils/contact-input.js';
import { validate } from '../utils/http-error.js';
import { NewsletterSubscriber } from '../models/newsletter-subscriber.js';
import { adminPage, adminSearch, directoryPage, literalSearch } from '../services/admin-directory.js';
import { sheetStream } from '../utils/product-sheet.js';
import { auditContactView, canViewFullContactLists, maskEmail } from '../services/admin-contact-access.js';
import { privateKey } from '../services/cod-risk.js';

const subscriberQuery = z.object({
  q: adminSearch,
  page: adminPage,
  status: z.enum(['subscribed', 'unsubscribed', 'all']).default('subscribed'),
});
const subscriberFields = '_id subscribedAt unsubscribedAt consent';
const subscriberSort = { subscribedAt: -1, _id: 1 };
const activeConsent = { 'consent.at': { $type: 'date' }, unsubscribedAt: { $exists: false } };

async function* subscriberRecords(filter) {
  yield ['email', 'subscribedAt', 'consentAt', 'consentVersion', 'source'];
  const cursor = NewsletterSubscriber.find(filter).select(subscriberFields).sort(subscriberSort).lean().cursor();
  try {
    for await (const entry of cursor) {
      yield [entry._id, entry.subscribedAt?.toISOString(), entry.consent.at.toISOString(),
        entry.consent.textVersion, entry.consent.source];
    }
  } finally {
    await cursor.close();
  }
}

export function createNewsletterRouter(session, secret) {
  const router = Router();
  router.use(noStore);
  router.post(
    '/',
    requestLimit({ limit: 10, message: 'Too many signup requests. Try again later.' }),
    async (req, res) => {
      const input = validate(newsletterInput, req.body);
      const user = await session.findUser(req);
      await subscribeToNewsletter(
        input,
        user?.email === input.email ? user._id : undefined,
        secret,
      );
      res.sendStatus(204);
    },
  );
  router.post('/unsubscribe/:token', async (req, res) => {
    await unsubscribe(validate(unsubscribeTokenInput, req.params.token));
    res.sendStatus(204);
  });
  return router;
}

export function createAdminNewsletterRouter(requireUser, secret) {
  const router = Router();
  router.use(noStore, requireUser, requirePermission(p.newsletterRead));
  router.get('/', async (req, res) => {
    const { q, page, status } = validate(subscriberQuery, req.query);
    const fullContact = canViewFullContactLists(res);
    const filter = {
      ...(q && { _id: fullContact ? literalSearch(q) : q.toLowerCase() }),
      ...(status === 'subscribed' && activeConsent),
      ...(status === 'unsubscribed' && { unsubscribedAt: { $exists: true } }),
    };
    const result = await directoryPage(NewsletterSubscriber, filter, subscriberFields, subscriberSort, page);
    if (fullContact) await auditContactView(req, res, 'newsletter:list', ['email'], result.items.length);
    result.items = result.items.map((item) => ({
      ...item,
      id: privateKey(secret, 'admin-subscriber-list', item._id),
      _id: fullContact ? item._id : maskEmail(item._id),
    }));
    res.json(result);
  });
  router.get('/export', requirePermission(p.newsletterExport), async (req, res) => {
    const q = validate(adminSearch, req.query.q);
    const filter = { ...activeConsent, ...(q && { _id: literalSearch(q) }) };
    await auditContactView(req, res, 'newsletter:export', ['email']);
    res.attachment('newsletter-subscribers.csv').type('text/csv; charset=utf-8');
    await pipeline(sheetStream('csv', subscriberRecords(filter)), res);
  });
  router.post('/unsubscribe-token', requirePermission(p.newsletterManage), async (req, res) => {
    const token = await getUnsubscribeToken(validate(contactEmail, req.body?.email), secret);
    res.json({ token });
  });
  return router;
}
