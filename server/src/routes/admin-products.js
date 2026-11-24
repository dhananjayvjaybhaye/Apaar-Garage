import { Router } from 'express';
import { adminProducts } from '../controllers/admin-products.js';
import { requireAdministrator } from '../middleware/administrator.js';
import { noStore } from '../middleware/http.js';

export function createAdminProductsRouter(requireUser) {
  const router = Router();
  router.use(noStore, requireUser, requireAdministrator);
  router.post('/', adminProducts.create);
  router.get('/:slug', adminProducts.detail);
  router.patch('/:slug', adminProducts.edit);
  router.patch('/:slug/stock', adminProducts.stock);
  return router;
}
