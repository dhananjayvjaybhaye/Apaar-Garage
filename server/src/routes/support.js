import { Router } from 'express';
import { submitSupport } from '../controllers/customer-contact.js';
import { requestLimit } from '../middleware/http.js';

export const supportRouter = Router();
supportRouter.post(
  '/',
  requestLimit({ limit: 5, message: 'Too many support requests. Try again later.' }),
  submitSupport,
);
