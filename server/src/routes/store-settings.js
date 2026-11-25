import { json, Router } from 'express';
import { requirePermission } from '../middleware/administrator.js';
import { adminPermission as p } from '../config/admin-permissions.js';
import { noStore } from '../middleware/http.js';
import { adminAudit } from '../services/audit.js';
import { publicStoreInfo } from '../services/store-settings.js';
import { launchBlockers } from '../services/launch-check.js';
import { HttpError } from '../utils/http-error.js';
import { settingsInput } from '../utils/store-settings-input.js';

export function createStoreSettingsRouter(requireUser, settings) {
  const router = Router();
  router.use(noStore, requireUser, requirePermission(p.settingsRead));
  router.get('/', async (_req, res) => res.json(await settings.read()));
  router.get('/readiness', async (_req, res) =>
    res.json({ blockers: await launchBlockers(await settings.read()) }));
  router.put('/', requirePermission(p.settingsWrite), json({ limit: '768kb' }), async (req, res) => {
    const result = settingsInput.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message }));
      throw new HttpError(400, issues[0].message, { issues }, 'INVALID_SETTINGS');
    }
    res.json(await settings.write(result.data, adminAudit(req, res)));
  });
  return router;
}

export function storeInfo(settings) {
  return async (_req, res) => res.json(publicStoreInfo(await settings.read()));
}
