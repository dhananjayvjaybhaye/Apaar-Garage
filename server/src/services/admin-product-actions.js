import { randomBytes } from 'node:crypto';
import { Product } from '../models/product.js';
import { productInput } from '../utils/product-input.js';
import { productIssues } from '../utils/product-issues.js';
import { HttpError } from '../utils/http-error.js';
import { adminBulkLimit } from '../config/admin-panel.js';
import { recordAudit } from './audit.js';
import { productSummary } from './audit-summaries.js';
import { adminProduct, createProduct, validateProduct } from './admin-products.js';
import { transaction } from './transaction.js';

export function draftProductIssues(input) {
  const candidate = { ...input, status: 'draft' };
  const parsed = productInput.safeParse(candidate);
  return parsed.success ? [] : productIssues(candidate, parsed.error.issues);
}

export function productChecklist(input) {
  const candidate = { ...input, status: 'published' };
  const parsed = productInput.safeParse(candidate);
  const issues = parsed.success ? [] : productIssues(candidate, parsed.error.issues);
  if (process.env.NODE_ENV === 'production' && candidate.placeholder === true) {
    issues.push({
      field: 'placeholder',
      message: 'Published placeholder listings are disabled in production.',
    });
  }
  return issues;
}

export function bulkProductStatus(slugs, status, audit) {
  return transaction(async (session) => {
    const products = await Product.find({ slug: { $in: slugs } })
      .select('+costPrice')
      .session(session);
    if (products.length !== slugs.length)
      throw new HttpError(404, 'Some selected products no longer exist.');
    if (status === 'published') {
      const errors = products.flatMap((product) =>
        productChecklist(product.toObject()).map((issue) => ({ ...issue, slug: product.slug })),
      );
      if (errors.length)
        throw new HttpError(
          400,
          'Fix the publication issues before publishing the selection.',
          errors,
        );
    }
    let updated = 0;
    for (const product of products) {
      if (product.status === status) continue;
      const before = productSummary(product);
      if (status === 'published') validateProduct({ ...product.toObject(), status });
      product.status = status;
      if (status === 'hidden') {
        // Hiding is always allowed, including older products whose editable data needs repair.
        await Product.updateOne({ _id: product._id }, { $set: { status } }, { session });
      } else {
        await product.save({ session });
      }
      await recordAudit(
        'product.status_changed',
        { ...audit, target: product.slug, before, after: productSummary(product) },
        session,
      );
      updated++;
    }
    return { updated };
  });
}

export async function duplicateProduct(
  slug,
  audit,
  { includeImages = true, suggestSku = false } = {},
) {
  const source = (await adminProduct(slug)).toObject();
  const id = randomBytes(4).toString('hex');
  const suffix = '-copy-' + id;
  const copySlug = slug.slice(0, 150 - suffix.length).replace(/-+$/, '') + suffix;
  const sku =
    suggestSku || !includeImages
      ? (source.sku ?? 'PRODUCT').slice(0, 150 - suffix.length) + suffix.toUpperCase()
      : undefined;
  const copy = {
    ...source,
    slug: copySlug,
    name: source.name + ' (copy)',
    status: 'draft',
    sku,
    barcode: undefined,
    stock: 0,
    featured: false,
  };
  if (includeImages) return createProduct(copy, audit, 'product.duplicated');
  // Without images, hand the admin a prefilled form. Keep the same save requirements.
  const {
    _id,
    __v,
    sales: _sales,
    ratingCount: _ratingCount,
    ratingTotal: _ratingTotal,
    ...fields
  } = copy;
  return { ...fields, images: [], imageAlts: [] };
}

export { adminBulkLimit };
