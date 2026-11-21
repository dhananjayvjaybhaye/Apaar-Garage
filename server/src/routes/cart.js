import { Router } from 'express';
import { createCartController } from '../controllers/cart.js';
import { noStore } from '../middleware/http.js';
import { HttpError } from '../utils/http-error.js';

function requireCartForWrite(req, res, next) {
  if (!res.locals.shopper.id && !['GET', 'HEAD'].includes(req.method)) {
    throw new HttpError(409, 'Your cart is empty.');
  }
  next();
}

export function createCartRouter(shopper, options) {
  const router = Router();
  const cart = createCartController(options);
  router.use(noStore, shopper, requireCartForWrite);
  router.get('/', cart.list);
  router.post('/items', cart.add);
  router.patch('/items/:slug', cart.update);
  router.delete('/items/:slug', cart.remove);
  return router;
}
