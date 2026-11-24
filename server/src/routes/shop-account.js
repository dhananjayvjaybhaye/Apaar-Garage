import { Router } from 'express';
import {
  addToWishlist,
  getAddresses,
  getWishlist,
  removeFromWishlist,
} from '../controllers/shop-account.js';
import { accountPrivacy } from '../controllers/account-privacy.js';
import { noStore, requestLimit } from '../middleware/http.js';

export function createShopAccountRouter(session, retentionDays) {
  const router = Router();
  router.use(noStore, session.requireUser);
  const privacy = accountPrivacy(session, retentionDays);
  router.get('/export', privacy.export);
  router.post(
    '/delete',
    requestLimit({ limit: 8, message: 'Too many attempts. Try again later.' }),
    privacy.close,
  );
  router.get('/wishlist', getWishlist);
  router.put('/wishlist/:slug', addToWishlist);
  router.delete('/wishlist/:slug', removeFromWishlist);
  router.get('/addresses', getAddresses);
  return router;
}
