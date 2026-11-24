// Reads and updates cart inventory without exposing HTTP details.
import { CartItem } from '../models/cart-item.js';
import { publicProductFilter } from '../utils/product-compliance.js';
import { transaction } from './transaction.js';
import { Product } from '../models/product.js';
import { HttpError } from '../utils/http-error.js';
import { maxCartQuantity, paisePerRupee, toPaise } from '../utils/commerce.js';

export async function readCart(user, options) {
  const lines = user
    ? await CartItem.find({ user })
        .sort({ createdAt: 1, _id: 1 })
        .populate({
          path: 'product',
          select: 'slug name price stock images',
          match: publicProductFilter(),
        })
        .lean()
    : [];
  const items = lines
    .filter((line) => line.product)
    .map(({ product, quantity }) => ({
      slug: product.slug,
      name: product.name,
      image: product.images[0] ?? null,
      price: product.price,
      stock: product.stock,
      quantity,
    }));

  const subtotalPaise = items.reduce(
    (total, item) => total + toPaise(item.price) * item.quantity,
    0,
  );
  const unavailableCount = lines.length - items.length;
  const threshold = options.freeDeliveryMinimum;
  return {
    items,
    ...(unavailableCount && { unavailableCount }),
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: subtotalPaise / paisePerRupee,
    freeDeliveryRemainingPaise:
      options.deliveryFee > 0 && threshold !== null ? Math.max(0, threshold - subtotalPaise) : null,
  };
}

async function getProduct(productSlug, session = null) {
  const product = await Product.findOne({ ...publicProductFilter(), slug: productSlug })
    .select('stock')
    .session(session)
    .lean();
  if (!product) throw new HttpError(404, 'Product not found.');
  return product;
}

function stockError() {
  return new HttpError(409, 'That quantity is unavailable. Check the stock limit.');
}

export async function addCartItem(user, input, session = null) {
  const product = await getProduct(input.slug, session);
  const identity = { user, product: product._id };
  const limit = Math.min(product.stock, maxCartQuantity);
  if (input.quantity > limit) throw stockError();

  const increment = () =>
    CartItem.updateOne(
      { ...identity, quantity: { $lte: limit - input.quantity } },
      { $inc: { quantity: input.quantity } },
      { session },
    );

  if (!(await increment()).matchedCount) {
    if (session) {
      if (await CartItem.exists(identity).session(session)) throw stockError();
      await new CartItem({ ...identity, quantity: input.quantity }).save({ session });
      return;
    }
    try {
      await CartItem.create({ ...identity, quantity: input.quantity });
    } catch (error) {
      if (error.code !== 11000) throw error;
      if (!(await increment()).matchedCount) throw stockError();
    }
  }
}

export async function updateCartItem(user, productSlug, input) {
  const product = await getProduct(productSlug);
  if (input.quantity > product.stock) throw stockError();

  const result = await CartItem.updateOne(
    { user, product: product._id },
    { $set: { quantity: input.quantity } },
    { runValidators: true },
  );
  if (!result.matchedCount) throw new HttpError(404, 'This product is not in your cart.');
}

export function removeUnavailableItems(user) {
  return transaction(async (session) => {
    const lines = await CartItem.find({ user }).select('product').session(session).lean();
    const available = await Product.find({
      ...publicProductFilter(),
      _id: { $in: lines.map(({ product }) => product) },
    })
      .select('_id')
      .session(session)
      .lean();
    const visible = new Set(available.map(({ _id }) => _id.toString()));
    const removals = lines.filter(({ product }) => !visible.has(product.toString()));
    if (removals.length)
      await CartItem.deleteMany(
        { user, _id: { $in: removals.map(({ _id }) => _id) } },
        { session },
      );
  });
}

export async function removeCartItem(user, productSlug) {
  const product = await Product.findOne({ slug: productSlug }).select('_id').lean();
  if (product) await CartItem.deleteOne({ user, product: product._id });
}
