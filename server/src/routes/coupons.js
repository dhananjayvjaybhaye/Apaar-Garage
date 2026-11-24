import { Router } from 'express';
import { noStore } from '../middleware/http.js';
import { requireAdministrator } from '../middleware/administrator.js';
import { Coupon } from '../models/coupon.js';
import { couponRule, saveCoupon } from '../services/discounts.js';
import { validate } from '../utils/http-error.js';

export function createCouponsRouter(requireUser, initialize) {
  const router = Router();
  router.use(noStore, requireUser, requireAdministrator);
  router.get('/', async (_req, res) => {
    await initialize();
    res.json({ items: await Coupon.find().sort({ _id: 1 }).lean() });
  });
  router.put('/', async (req, res) => {
    const input = validate(couponRule, req.body);
    await initialize();
    res.json(await saveCoupon(input));
  });
  return router;
}
