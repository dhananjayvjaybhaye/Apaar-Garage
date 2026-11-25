import { Router } from 'express';
import { noStore } from '../middleware/http.js';
import { requirePermission } from '../middleware/administrator.js';
import { adminPermission as p } from '../config/admin-permissions.js';
import { Coupon } from '../models/coupon.js';
import { couponRule, createCoupon, saveCoupon } from '../services/discounts.js';
import { adminAudit, recordAudit } from '../services/audit.js';
import { transaction } from '../services/transaction.js';
import { HttpError, validate } from '../utils/http-error.js';

function couponSummary(coupon) {
  const { active, percent, amountPaise, minimumPaise, startsAt, endsAt, totalLimit, perCustomerLimit } = coupon;
  return { active, percent, amountPaise, minimumPaise, startsAt, endsAt, totalLimit, perCustomerLimit };
}

export function createCouponsRouter(requireUser, initialize) {
  const router = Router();
  router.use(noStore, requireUser, requirePermission(p.coupons));
  router.get('/', async (_req, res) => {
    await initialize();
    res.json({ items: await Coupon.find().sort({ _id: 1 }).lean() });
  });
  async function write(req, res, create) {
    const input = validate(couponRule, req.body);
    await initialize();
    try {
      const value = await transaction(async (session) => {
        const before = create ? null : await Coupon.findById(input.code).session(session).lean();
        const updated = create ? await createCoupon(input, session) : await saveCoupon(input, session);
        await recordAudit(before ? 'coupon.updated' : 'coupon.created', {
          ...adminAudit(req, res), target: input.code,
          ...(before && { before: couponSummary(before) }), after: couponSummary(updated),
        }, session);
        return updated;
      });
      res.status(create ? 201 : 200).json(value);
    } catch (error) {
      if (error.code === 11000) throw new HttpError(409, 'A coupon with this code already exists.');
      throw error;
    }
  }
  router.post('/', (req, res) => write(req, res, true));
  router.put('/', (req, res) => write(req, res, false));
  return router;
}
