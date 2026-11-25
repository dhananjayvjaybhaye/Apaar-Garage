import { Router } from 'express';
import { listAdminAudit } from '../services/admin-audit-list.js';
import { adminDashboard } from '../services/admin-dashboard.js';

export function createAdminOverviewRouter(requireAdmin) {
  const router = Router();
  router.get('/dashboard', requireAdmin, async (_req, res) => res.json(await adminDashboard()));
  router.get('/audit', requireAdmin, async (_req, res) =>
    res.json({ items: await listAdminAudit() }),
  );
  return router;
}
