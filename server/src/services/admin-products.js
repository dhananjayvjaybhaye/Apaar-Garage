import { Product } from '../models/product.js';
import { HttpError } from '../utils/http-error.js';
import { productInput } from '../utils/product-input.js';
import { applyStockMovements } from './stock.js';
import { transaction } from './transaction.js';

function validateProduct(value) {
  const result = productInput.safeParse(value);
  if (result.success) return result.data;
  throw new HttpError(
    400,
    'Review the product fields.',
    result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
  );
}

export async function adminProduct(slug, session = null) {
  const product = await Product.findOne({ slug }).select('+costPrice').session(session);
  if (!product) throw new HttpError(404, 'Product not found.');
  return product;
}

async function saveProduct(product, session) {
  try {
    await product.save({ session });
  } catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'The SKU or slug already exists.');
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

export function createProduct(input, actor) {
  const { stock, ...values } = validateProduct(input);
  return transaction(async (session) => {
    const product = new Product({ ...values, stock: 0 });
    await saveProduct(product, session);
    await applyStockMovements([{ product: product._id, delta: stock }], {
      reason: 'opening',
      actor,
      session,
    });
    return adminProduct(product.slug, session);
  });
}

export function editProduct(slug, input) {
  return transaction(async (session) => {
    const product = await adminProduct(slug, session);
    const values = validateProduct({ ...product.toObject(), ...input, slug, stock: product.stock });
    product.set(values);
    await saveProduct(product, session);
    return product;
  });
}

export function adjustStock(slug, delta, actor) {
  return transaction(async (session) => {
    const product = await adminProduct(slug, session);
    await applyStockMovements([{ product: product._id, delta }], {
      reason: 'adjustment',
      actor,
      session,
    });
    return adminProduct(slug, session);
  });
}
