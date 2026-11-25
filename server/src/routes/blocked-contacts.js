import { Router } from 'express';
import { z } from 'zod';
import { BlockedContact } from '../models/cod-risk.js';
import { requireAdministrator } from '../middleware/administrator.js';
import { noStore } from '../middleware/http.js';
import { pincode } from '../services/delivery.js';
import { HttpError, validate } from '../utils/http-error.js';
import { indianPhone } from '../utils/indian-phone.js';
import { adminAudit, recordAudit } from '../services/audit.js';
import { adminPage, directoryPage } from '../services/admin-directory.js';
import { transaction } from '../services/transaction.js';

const input = z
  .strictObject({
    phone: indianPhone.optional(),
    pincode: pincode.optional(),
    reason: z.string().trim().min(1).max(250),
  })
  .refine(({ phone, pincode }) => Boolean(phone || pincode), 'Provide a phone number or pincode.');
const id = z.string().regex(/^[0-9a-f]{24}$/i);
const removal = z.strictObject({ reason: z.string().trim().min(1).max(250) });

export function createBlockedContactsRouter(requireUser) {
  const router = Router();
  router.use(noStore, requireUser, requireAdministrator);
  router.get('/', async (req, res) => {
    const page = validate(adminPage, req.query.page);
    res.json(await directoryPage(BlockedContact, {}, 'phone pincode reason createdAt',
      { createdAt: -1, _id: -1 }, page, 100));
  });
  router.post('/', async (req, res) => {
    const value = validate(input, req.body);
    try {
      const contact = await transaction(async (session) => {
        const [created] = await BlockedContact.create([value], { session });
        await recordAudit('contact.blocked', {
          ...adminAudit(req, res), target: String(created._id), after: { reason: value.reason },
        }, session);
        return created;
      });
      res.status(201).json(contact);
    } catch (error) {
      if (error.code === 11000)
        throw new HttpError(409, 'These contact details are already blocked.');
      throw error;
    }
  });
  router.delete('/:id', async (req, res) => {
    const contactId = validate(id, req.params.id);
    // Older API clients omitted the body. The admin form always supplies a reason.
    const reason = req.body === undefined ? 'Removed through legacy API' : validate(removal, req.body).reason;
    await transaction(async (session) => {
      const contact = await BlockedContact.findByIdAndDelete(contactId, { session }).lean();
      if (!contact) return;
      await recordAudit('contact.unblocked', {
        ...adminAudit(req, res), target: contactId, after: { reason },
      }, session);
    });
    res.sendStatus(204);
  });
  return router;
}
