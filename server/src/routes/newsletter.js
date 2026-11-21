import { Router } from 'express';
import { subscribe } from '../controllers/customer-contact.js';
import { requestLimit } from '../middleware/http.js';

export const newsletterRouter = Router();
newsletterRouter.post(
  '/',
  requestLimit({ limit: 10, message: 'Too many signup requests. Try again later.' }),
  subscribe,
);
