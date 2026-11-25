import { z } from 'zod';
import { adminAudit } from '../services/audit.js';
import {
  adjustStock,
  adminProduct,
  createProduct,
  editProduct,
} from '../services/admin-products.js';
import {
  adminBulkLimit,
  bulkProductStatus,
  duplicateProduct,
  productChecklist,
  draftProductIssues,
} from '../services/admin-product-actions.js';
import { adminProductQuery, listAdminProducts } from '../services/admin-product-list.js';
import { validate } from '../utils/http-error.js';
import { productSlug } from '../utils/product-input.js';
import { adminPermission, hasAdminPermission } from '../config/admin-permissions.js';

const payload = z.record(z.string(), z.unknown());
const patch = payload
  .refine(
    (fields) => !['stock', 'slug'].some((field) => Object.hasOwn(fields, field)),
    'Use the stock adjustment endpoint for stock. Product slugs are fixed.',
  )
  .refine((fields) => fields.status !== null, 'Choose a product status.');
const adjustment = z.strictObject({
  delta: z.int().refine((delta) => delta !== 0),
  reason: z.string().trim().min(1).max(240).default('Manual adjustment'),
});
const duplicateOptions = z.strictObject({
  includeImages: z.boolean().default(true),
  suggestSku: z.boolean().default(false),
});
const bulk = z.strictObject({
  slugs: z
    .array(productSlug)
    .min(1)
    .max(adminBulkLimit)
    .refine((slugs) => new Set(slugs).size === slugs.length),
  status: z.enum(['published', 'hidden']),
});
const slug = (request) => validate(productSlug, request.params.slug);

export const adminProducts = {
  async list(req, res) {
    res.json(await listAdminProducts(validate(adminProductQuery, req.query),
      hasAdminPermission(res.locals.user, adminPermission.productCost)));
  },
  async checklist(req, res) {
    const candidate = validate(payload, req.body);
    res.json({ issues: productChecklist(candidate), draftIssues: draftProductIssues(candidate) });
  },
  async bulk(req, res) {
    const { slugs, status } = validate(bulk, req.body);
    res.json(await bulkProductStatus(slugs, status, adminAudit(req, res)));
  },
  async detail(req, res) {
    const includeCost = hasAdminPermission(res.locals.user, adminPermission.productCost);
    res.json((await adminProduct(slug(req), null, includeCost)).toObject());
  },
  async create(req, res) {
    res.status(201).json((await createProduct(req.body, adminAudit(req, res))).toObject());
  },
  async duplicate(req, res) {
    const options = validate(duplicateOptions, req.body);
    const copy = await duplicateProduct(slug(req), adminAudit(req, res), options);
    res
      .status(options.includeImages ? 201 : 200)
      .json(options.includeImages ? copy.toObject() : copy);
  },
  async edit(req, res) {
    res.json(
      (await editProduct(slug(req), validate(patch, req.body), adminAudit(req, res))).toObject(),
    );
  },
  async stock(req, res) {
    const { delta, reason } = validate(adjustment, req.body);
    res.json((await adjustStock(slug(req), delta, adminAudit(req, res), reason)).toObject());
  },
};
