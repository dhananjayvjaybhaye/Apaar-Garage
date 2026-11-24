import { adminAudit } from '../services/audit.js';
import { z } from 'zod';
import {
  adjustStock,
  adminProduct,
  createProduct,
  editProduct,
} from '../services/admin-products.js';
import { validate } from '../utils/http-error.js';
import { productSlug } from '../utils/product-input.js';

const patch = z
  .record(z.string(), z.unknown())
  .refine(
    (fields) => !['stock', 'slug'].some((field) => Object.hasOwn(fields, field)),
    'Use the stock adjustment endpoint for stock. Product slugs are fixed.',
  );
const adjustment = z.strictObject({ delta: z.int().refine((delta) => delta !== 0) });

const slug = (request) => validate(productSlug, request.params.slug);

export const adminProducts = {
  async detail(req, res) {
    res.json((await adminProduct(slug(req))).toObject());
  },
  async create(req, res) {
    res.status(201).json((await createProduct(req.body, adminAudit(req, res))).toObject());
  },
  async edit(req, res) {
    res.json(
      (await editProduct(slug(req), validate(patch, req.body), adminAudit(req, res))).toObject(),
    );
  },
  async stock(req, res) {
    const { delta } = validate(adjustment, req.body);
    res.json((await adjustStock(slug(req), delta, adminAudit(req, res))).toObject());
  },
};
