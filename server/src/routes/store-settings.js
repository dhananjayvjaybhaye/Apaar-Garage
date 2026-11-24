import { Router } from 'express';
import { requireAdministrator } from '../middleware/administrator.js';
import { noStore } from '../middleware/http.js';
import { publicStoreInfo } from '../services/store-settings.js';
import { validate } from '../utils/http-error.js';
import { settingsInput } from '../utils/store-settings-input.js';

export function createStoreSettingsRouter(session, settings) {
  const router = Router();
  router.use(noStore, session.requireUser, requireAdministrator);
  router.get('/', async (_req, res) => res.json(await settings.read()));
  router.put('/', async (req, res) =>
    res.json(await settings.write(validate(settingsInput, req.body))),
  );
  return router;
}

export function storeInfo(settings) {
  return async (_req, res) => res.json(publicStoreInfo(await settings.read()));
}
