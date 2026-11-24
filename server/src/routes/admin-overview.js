import { Router } from 'express';
import { auditPageSize } from '../config/admin-security.js';
import { AuditLog } from '../models/admin-security.js';

export function createAdminOverviewRouter(requireAdmin) {
  const router = Router();
  router.get('/audit', requireAdmin, async (_req, res) => {
    const items = await AuditLog.find()
      .select('-__v')
      .sort({ at: -1, _id: -1 })
      .limit(auditPageSize)
      .lean();
    res.json({ items });
  });
  return router;
}
