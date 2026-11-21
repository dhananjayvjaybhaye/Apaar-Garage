import { Router } from 'express';
import { createOrdersController } from '../controllers/orders.js';
import { noStore, requestLimit } from '../middleware/http.js';
import { HttpError } from '../utils/http-error.js';

function limitOrderCreation(identifier, limit, keyGenerator) {
  return requestLimit({
    identifier,
    limit,
    keyGenerator,
    message: 'Too many order attempts. Try again later.',
  });
}

function requireOrderCart(_req, res, next) {
  if (!res.locals.shopper.id) throw new HttpError(409, 'Your cart is empty.');
  next();
}

function requireAdministrator(_req, res, next) {
  if (res.locals.user.role !== 'admin')
    throw new HttpError(403, 'Administrator access is required.');
  next();
}

export function createOrdersRouter(requireUser, shopper, options) {
  const router = Router();
  const orders = createOrdersController(options);
  router.use(noStore);
  router.post(
    '/',
    limitOrderCreation('order-ip', 24),
    shopper,
    requireOrderCart,
    limitOrderCreation('order-user', 8, (_req, res) => res.locals.shopper.id.toString()),
    orders.place,
  );
  router.get('/quote', shopper, orders.quote);
  router.get('/', requireUser, orders.list);
  router.get('/:orderNumber', shopper, orders.find);
  router.post('/:orderNumber/cancel', shopper, orders.cancel);
  return router;
}

export function createAdminOrdersRouter(requireUser, options) {
  const router = Router();
  const orders = createOrdersController(options);
  router.use(noStore, requireUser, requireAdministrator);
  router.patch('/:orderNumber/status', orders.changeStatus);
  router.patch('/:orderNumber/payment', orders.collectPayment);
  return router;
}
