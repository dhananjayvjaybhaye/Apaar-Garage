// Reads and updates cart inventory without exposing HTTP details.
import { CartItem } from '../models/cart-item.js';
import { Product } from '../models/product.js';
import { HttpError } from '../utils/http-error.js';
import { maxCartQuantity, paisePerRupee, toPaise } from '../utils/commerce.js';

export async function readCart(user, options) {
  const lines = user
    ? await CartItem.find({ user })
        .sort({ createdAt: 1, _id: 1 })
        .populate('product', 'slug name price stock images')
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
  const threshold = options.freeDeliveryMinimum;
  return {
    items,
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: subtotalPaise / paisePerRupee,
    freeDeliveryRemainingPaise:
      options.deliveryFee > 0 && threshold !== null ? Math.max(0, threshold - subtotalPaise) : null,
  };
}

async function getProduct(productSlug) {
  const product = await Product.findOne({ slug: productSlug }).select('stock').lean();
  if (!product) throw new HttpError(404, 'Product not found.');
  return product;
}

function stockError() {
  return new HttpError(409, 'That quantity is unavailable. Check the stock limit.');
}

export async function addCartItem(user, input) {
  const product = await getProduct(input.slug);
  const identity = { user, product: product._id };
  const limit = Math.min(product.stock, maxCartQuantity);
  if (input.quantity > limit) throw stockError();

  const increment = () =>
    CartItem.updateOne(
      { ...identity, quantity: { $lte: limit - input.quantity } },
      { $inc: { quantity: input.quantity } },
    );

  if (!(await increment()).matchedCount) {
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

export async function removeCartItem(user, productSlug) {
  const product = await Product.findOne({ slug: productSlug }).select('_id').lean();
  if (product) await CartItem.deleteOne({ user, product: product._id });
}
