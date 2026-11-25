import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { orderBusiness } from '../controllers/order-business.js';
import { createOrdersController } from '../controllers/orders.js';
import { noStore, requestLimit } from '../middleware/http.js';
import { requireAdministrator } from '../middleware/administrator.js';
import { HttpError } from '../utils/http-error.js';
import { listAdminOrders, orderRecords, readOrderQuery } from '../services/admin-orders.js';
import { sheetStream } from '../utils/product-sheet.js';

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
  router.get('/:orderNumber/invoice', shopper, orderBusiness.invoice);
  router.get('/:orderNumber/returns', shopper, orderBusiness.returns);
  router.post('/:orderNumber/returns', shopper, orderBusiness.requestReturn);
  return router;
}

export function createAdminOrdersRouter(requireUser, options) {
  const router = Router();
  const orders = createOrdersController(options);
  router.use(noStore, requireUser, requireAdministrator);
  router.get('/', async (req, res) => {
    const { risk } = await options.settings.read();
    res.json(await listAdminOrders(readOrderQuery(req.query, risk), risk));
  });
  router.get('/export', async (req, res) => {
    const { risk } = await options.settings.read();
    const query = readOrderQuery(req.query, risk);
    res.attachment('orders.csv').type('text/csv; charset=utf-8');
    await pipeline(sheetStream('csv', orderRecords(query, risk)), res);
  });
  router.get('/:orderNumber/packing-slip', orderBusiness.packingSlip);
  router.get('/:orderNumber/invoice', orderBusiness.adminInvoice);
  router.get('/:orderNumber', (req, res) => orderBusiness.adminDetail(req, res, options.settings));
  router.get('/:orderNumber/returns', orderBusiness.adminReturns);
  router.patch('/:orderNumber/returns/:id', orderBusiness.changeReturn);
  router.post('/:orderNumber/notes', orderBusiness.addNote);
  router.patch('/:orderNumber/confirmation', orderBusiness.confirm);
  router.patch('/:orderNumber/status', orders.changeStatus);
  router.patch('/:orderNumber/payment', orders.collectPayment);
  return router;
}
