import { Router } from 'express';
import { adminPermission as p } from '../config/admin-permissions.js';
import { requirePermission } from '../middleware/administrator.js';
import { listAdminAudit } from '../services/admin-audit-list.js';
import { adminDashboard } from '../services/admin-dashboard.js';

export function createAdminOverviewRouter(requireAdmin) {
  const router = Router();
  router.get('/dashboard', requireAdmin, requirePermission(p.dashboard), async (_req, res) => res.json(await adminDashboard()));
  router.get('/audit', requireAdmin, requirePermission(p.audit), async (_req, res) =>
    res.json({ items: await listAdminAudit() }),
  );
  return router;
}
