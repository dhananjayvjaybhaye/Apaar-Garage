import { Router } from 'express';
import { z } from 'zod';
import { BlockedContact } from '../models/cod-risk.js';
import { requireAdministrator } from '../middleware/administrator.js';
import { noStore } from '../middleware/http.js';
import { pincode } from '../services/delivery.js';
import { HttpError, validate } from '../utils/http-error.js';
import { indianPhone } from '../utils/indian-phone.js';

const input = z
  .strictObject({
    phone: indianPhone.optional(),
    pincode: pincode.optional(),
    reason: z.string().trim().min(1).max(250),
  })
  .refine(({ phone, pincode }) => Boolean(phone || pincode), 'Provide a phone number or pincode.');
const id = z.string().regex(/^[0-9a-f]{24}$/i);

export function createBlockedContactsRouter(requireUser) {
  const router = Router();
  router.use(noStore, requireUser, requireAdministrator);
  router.get('/', async (_req, res) => {
    res.json({ items: await BlockedContact.find().sort({ createdAt: -1 }).limit(100).lean() });
  });
  router.post('/', async (req, res) => {
    const value = validate(input, req.body);
    try {
      res.status(201).json(await BlockedContact.create(value));
    } catch (error) {
      if (error.code === 11000)
        throw new HttpError(409, 'These contact details are already blocked.');
      throw error;
    }
  });
  router.delete('/:id', async (req, res) => {
    await BlockedContact.deleteOne({ _id: validate(id, req.params.id) });
    res.sendStatus(204);
  });
  return router;
}
