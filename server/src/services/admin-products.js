import { recordAudit } from './audit.js';
import { productSummary } from './audit-summaries.js';
import { Product } from '../models/product.js';
import { HttpError } from '../utils/http-error.js';
import { productFields, productInput } from '../utils/product-input.js';
import { productIssues } from '../utils/product-issues.js';
import { applyStockMovements } from './stock.js';
import { transaction } from './transaction.js';

const editableFields = new Set(
  productFields.options.flatMap((option) => Object.keys(option.shape)),
);

export function validateProduct(value) {
  const result = productInput.safeParse(value);
  if (result.success) {
    if (
      process.env.NODE_ENV === 'production' &&
      result.data.status === 'published' &&
      result.data.placeholder
    ) {
      throw new HttpError(400, 'Review the product fields.', [
        {
          field: 'placeholder',
          message: 'Published placeholder listings are disabled in production.',
        },
      ]);
    }
    return result.data;
  }
  throw new HttpError(400, 'Review the product fields.', productIssues(value, result.error.issues));
}

export async function adminProduct(slug, session = null) {
  const product = await Product.findOne({ slug }).select('+costPrice').session(session);
  if (!product) throw new HttpError(404, 'Product not found.');
  return product;
}

export async function saveProduct(product, session) {
  try {
    await product.save({ session });
  } catch (error) {
    if (error.code === 11000) {
      const message = 'The SKU or slug already exists.';
      const field = ['sku', 'slug'].find((key) => Object.hasOwn(error.keyPattern ?? {}, key));
      throw new HttpError(
        409,
        message,
        field ? [{ field, message: 'Choose a unique value.' }] : undefined,
      );
    }
    if (error.name === 'ValidationError') {
      throw new HttpError(
        400,
        'Review the product fields.',
        Object.values(error.errors).map(({ path, message }) => ({ field: path, message })),
      );
    }
    throw error;
  }
}

export function createProduct(input, audit, action = 'product.created') {
  const { stock, ...values } = validateProduct(input);
  return transaction(async (session) => {
    const product = new Product({ ...values, stock: 0 });
    await saveProduct(product, session);
    await applyStockMovements([{ product: product._id, delta: stock }], {
      reason: 'opening',
      actor: audit.who,
      session,
    });
    const created = await adminProduct(product.slug, session);
    await recordAudit(
      action,
      { ...audit, target: created.slug, after: productSummary(created) },
      session,
    );
    return created;
  });
}

export function editProduct(slug, input, audit) {
  return transaction(async (session) => {
    const product = await adminProduct(slug, session);
    const patch = Object.fromEntries(
      Object.entries(input)
        .filter(([key]) => editableFields.has(key))
        .map(([key, value]) => [key, value === null ? undefined : value]),
    );
    const values = validateProduct({ ...product.toObject(), ...patch, slug, stock: product.stock });
    const before = productSummary(product);
    product.set(values);
    for (const [field, value] of Object.entries(patch)) {
      if (value === undefined && !Object.hasOwn(values, field)) product.set(field, undefined);
    }
    await saveProduct(product, session);
    await recordAudit(
      'product.updated',
      {
        ...audit,
        target: slug,
        before,
        after: { ...productSummary(product), fields: Object.keys(patch) },
      },
      session,
    );
    return product;
  });
}

export function adjustStock(slug, delta, audit, adjustmentReason) {
  return transaction(async (session) => {
    const product = await adminProduct(slug, session);
    await applyStockMovements([{ product: product._id, delta }], {
      reason: 'adjustment',
      adjustmentReason,
      actor: audit.who,
      session,
    });
    const updated = await adminProduct(slug, session);
    await recordAudit(
      'product.stock_adjusted',
      {
        ...audit,
        target: slug,
        before: productSummary(product),
        after: { ...productSummary(updated), reasonRecorded: Boolean(adjustmentReason) },
      },
      session,
    );
    return updated;
  });
}
