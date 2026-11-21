import { Router } from 'express';
import {
  addToWishlist,
  getAddresses,
  getWishlist,
  removeFromWishlist,
} from '../controllers/shop-account.js';
import { noStore } from '../middleware/http.js';

export function createShopAccountRouter(requireUser) {
  const router = Router();
  router.use(noStore, requireUser);
  router.get('/wishlist', getWishlist);
  router.put('/wishlist/:slug', addToWishlist);
  router.delete('/wishlist/:slug', removeFromWishlist);
  router.get('/addresses', getAddresses);
  return router;
}
