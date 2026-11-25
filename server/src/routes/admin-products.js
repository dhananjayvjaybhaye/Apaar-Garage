import { Router } from 'express';
import { adminProducts } from '../controllers/admin-products.js';
import { requirePermission } from '../middleware/administrator.js';
import { adminPermission as p } from '../config/admin-permissions.js';
import { noStore } from '../middleware/http.js';

export function createAdminProductsRouter(requireUser) {
  const router = Router();
  router.use(noStore, requireUser, requirePermission(p.productRead));
  const write = requirePermission(p.productWrite);
  router.get('/', adminProducts.list);
  router.post('/', write, adminProducts.create);
  router.post('/checklist', write, adminProducts.checklist);
  router.patch('/bulk-status', write, adminProducts.bulk);
  router.get('/:slug', adminProducts.detail);
  router.patch('/:slug', write, adminProducts.edit);
  router.patch('/:slug/stock', write, adminProducts.stock);
  router.post('/:slug/duplicate', write, adminProducts.duplicate);
  return router;
}
