import { Router } from 'express';
import { noStore, requestLimit } from '../middleware/http.js';
import { requireAdministrator } from '../middleware/administrator.js';
import { subscribeToNewsletter, getUnsubscribeToken, unsubscribe } from '../services/newsletter.js';
import { contactEmail, newsletterInput, unsubscribeTokenInput } from '../utils/contact-input.js';
import { validate } from '../utils/http-error.js';

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
  router.use(noStore, requireUser, requireAdministrator);
  router.post('/unsubscribe-token', async (req, res) => {
    const token = await getUnsubscribeToken(validate(contactEmail, req.body?.email), secret);
    res.json({ token });
  });
  return router;
}
