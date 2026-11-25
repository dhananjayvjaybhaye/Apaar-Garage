import { Router } from 'express';
import { z } from 'zod';
import { SupportRequest } from '../models/support-request.js';
import { ticketStatuses } from '../config/store-policy.js';
import { noStore, requestLimit } from '../middleware/http.js';
import { requireAdministrator } from '../middleware/administrator.js';
import {
  findTicket,
  publicTicket,
  recordSupportRequest,
  replyToTicket,
  supportActions,
  updateTicket,
} from '../services/support-tickets.js';
import {
  lookupInput,
  replyInput,
  supportInput,
  ticketNumberInput,
  updateSupportInput,
} from '../utils/contact-input.js';
import { validate } from '../utils/http-error.js';
import { adminPage, adminSearch, directoryPage, literalSearch } from '../services/admin-directory.js';
import { adminAudit } from '../services/audit.js';

export function createSupportRouter(session) {
  const router = Router();
  router.use(noStore);
  const limit = requestLimit({ limit: 15, message: 'Too many support requests. Try again later.' });
  router.post('/', limit, async (req, res) => {
    const input = validate(supportInput, req.body);
    const user = await session.findUser(req);
    const ticket = await recordSupportRequest(
      input,
      user?.email === input.email ? user._id : undefined,
    );
    res.status(201).json({ reference: ticket.ticketNumber, ...publicTicket(ticket) });
  });
  router.post('/status', limit, async (req, res) => {
    res.json(publicTicket(await findTicket(validate(lookupInput, req.body))));
  });
  router.post('/reply', limit, async (req, res) => {
    const { message, ...filter } = validate(replyInput, req.body);
    res.json(publicTicket(await replyToTicket(filter, message)));
  });
  return router;
}

const ticketPageSize = 50;
const ticketListQuery = z.object({
  status: z.enum(ticketStatuses).optional(),
  page: adminPage,
  q: adminSearch,
  deadline: z.enum(['acknowledge', 'resolve']).optional(),
});

export function createAdminSupportRouter(requireUser) {
  const router = Router();
  router.use(noStore, requireUser, requireAdministrator);
  router.get('/', async (req, res) => {
    const { status, page, q, deadline } = validate(ticketListQuery, req.query);
    const term = q ? literalSearch(q) : undefined;
    const now = new Date();
    const filter = {
      anonymizedAt: { $exists: false },
      ...(status && { status }),
      ...(term && { $or: [{ ticketNumber: term }, { email: term }, { name: term }, { orderNumber: term }] }),
      ...(deadline === 'acknowledge' && { acknowledgedAt: null, acknowledgeBy: { $lte: now } }),
      ...(deadline === 'resolve' && { resolvedAt: null, dueAt: { $lte: now } }),
    };
    res.json(await directoryPage(SupportRequest, filter,
      'ticketNumber category status acknowledgeBy acknowledgedAt dueAt resolvedAt email name createdAt',
      { createdAt: -1, _id: -1 }, page, ticketPageSize));
  });
  router.get('/:ticketNumber', async (req, res) => {
    const ticket = await findTicket({ ticketNumber: validate(ticketNumberInput, req.params.ticketNumber) });
    res.json({ ...ticket, actions: supportActions(ticket) });
  });
  router.patch('/:ticketNumber', async (req, res) => {
    res.json(
      await updateTicket(
        validate(ticketNumberInput, req.params.ticketNumber),
        validate(updateSupportInput, req.body),
        adminAudit(req, res),
      ),
    );
  });
  return router;
}
