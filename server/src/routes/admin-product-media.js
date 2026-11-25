import express, { Router } from 'express';
import { imageMaxBytes, modelMaxBytes } from '../config/admin-panel.js';
import { convertProductImage, validateProductModel } from '../services/product-media.js';
import { HttpError } from '../utils/http-error.js';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const modelTypes = ['model/gltf-binary', 'application/octet-stream'];

function upload(types, limit, convert, suffix, media) {
  return [
    (req, _res, next) => {
      if (!req.is(types)) throw new HttpError(415, 'The upload format is not supported.');
      next();
    },
    express.raw({ type: types, limit, inflate: false }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        throw new HttpError(400, 'Choose a file to upload.');
      const bytes = await convert(req.body);
      res.status(201).json({ url: await media.save(bytes, suffix), bytes: bytes.length });
    },
  ];
}

export function createAdminProductMediaRouter(requireAdmin, media) {
  const router = Router();
  router.use(requireAdmin);
  router.post('/image', ...upload(imageTypes, imageMaxBytes, convertProductImage, 'webp', media));
  router.post('/model', ...upload(modelTypes, modelMaxBytes, validateProductModel, 'glb', media));
  return router;
}
