import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { returnStatuses } from '../config/business.js';
import { noStore } from '../middleware/http.js';
import { requirePermission } from '../middleware/administrator.js';
import { adminPermission as p } from '../config/admin-permissions.js';
import { auditContactView } from '../services/admin-contact-access.js';
import { Order } from '../models/order.js';
import { ReturnRequest } from '../models/return-request.js';
import { adminPage, adminSearch, customerDirectory, customerExportRows, directoryPage, literalSearch } from '../services/admin-directory.js';
import { availableRefund, returnActions } from '../services/returns.js';
import { HttpError, validate } from '../utils/http-error.js';
import { returnId } from '../utils/order-business-input.js';
import { sheetStream } from '../utils/product-sheet.js';

const customerQuery = z.object({ q: adminSearch, page: adminPage });
const returnQuery = customerQuery.extend({ status: z.enum(returnStatuses).optional() });

export function createAdminFulfillmentRouter(requireAdmin) {
  const router = Router();
  router.get('/customers', noStore, requireAdmin, requirePermission(p.customers), async (req, res) => {
    const result = await customerDirectory(validate(customerQuery, req.query));
    await auditContactView(req, res, 'customers:list', ['email'], result.items.length);
    res.json(result);
  });
  router.get('/customers/export', noStore, requireAdmin, requirePermission(p.customerExport), async (req, res) => {
    const q = validate(adminSearch, req.query.q);
    await auditContactView(req, res, 'customers:export', ['email']);
    res.attachment('customers.csv').type('text/csv; charset=utf-8');
    await pipeline(sheetStream('csv', customerExportRows(q)), res);
  });
  router.get('/returns', noStore, requireAdmin, requirePermission(p.returns), async (req, res) => {
    const { q, page, status } = validate(returnQuery, req.query);
    const filter = { ...(q && { orderNumber: literalSearch(q) }), ...(status && { status }) };
    res.json(await directoryPage(ReturnRequest, filter,
      'orderNumber reason status createdAt maximumRefundPaise',
      { createdAt: -1, _id: -1 }, page));
  });
  router.get('/returns/:id', noStore, requireAdmin, requirePermission(p.returns), async (req, res) => {
    const request = await ReturnRequest.findById(validate(returnId, req.params.id)).lean();
    if (!request) throw new HttpError(404, 'Return request not found.');
    const order = await Order.findOne({ number: request.orderNumber })
      .select('items.slug items.name paymentStatus status totalPaise').lean();
    const names = new Map(order?.items.map(({ slug, name }) => [slug, name]));
    const refundLimitPaise = request.status === 'received' && order?.paymentStatus === 'collected'
      ? await availableRefund(order, request)
      : 0;
    res.json({
      ...request,
      items: request.items.map(({ product: _product, ...item }) => ({ ...item, name: names.get(item.slug) })),
      actions: returnActions(request, order, refundLimitPaise),
      refundLimitPaise,
      paymentCollected: order?.paymentStatus === 'collected',
    });
  });
  return router;
}
