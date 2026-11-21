// Prices the cart and creates a quote that can be verified again inside checkout.
import { createHash } from 'node:crypto';
import { CartItem } from '../models/cart-item.js';
import { Product } from '../models/product.js';
import { HttpError } from '../utils/http-error.js';
import { paisePerRupee, toPaise } from '../utils/commerce.js';
import { discountFor } from './discounts.js';
import { deliveryFor, shippingCost } from './delivery.js';

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
});
export function stockError(name) {
  return new HttpError(
    409,
    name
      ? 'There is insufficient stock for ' + name + '. Update your cart.'
      : 'Stock changed. Review your cart and try again.',
  );
}

async function readCartProducts(user, session) {
  if (!user) throw new HttpError(409, 'Your cart is empty.');
  const lines = await CartItem.find({ user }).sort({ _id: 1 }).session(session).lean();
  if (!lines.length) throw new HttpError(409, 'Your cart is empty.');

  const products = await Product.find({
    _id: { $in: lines.map((line) => line.product) },
  })
    .select('slug name price stock')
    .session(session)
    .lean();
  return {
    lines,
    productsById: new Map(products.map((product) => [product._id.toString(), product])),
  };
}

function priceOrderItem(line, product) {
  if (!product) throw new HttpError(409, 'A product in your cart is no longer available.');
  if (product.stock < line.quantity) throw stockError(product.name);
  const unitPricePaise = toPaise(product.price);
  if (!Number.isSafeInteger(unitPricePaise) || unitPricePaise < 0) {
    throw new HttpError(409, 'A price is unavailable for ' + product.name + '.');
  }
  return {
    product: product._id,
    slug: product.slug,
    name: product.name,
    quantity: line.quantity,
    unitPricePaise,
  };
}

function quoteDelivery(options, pin, subtotalPaise) {
  const delivery = deliveryFor(options, pin);
  if (!delivery.cod) throw new HttpError(409, 'Cash on Delivery is unavailable for this pincode.');
  const shippingPaise = shippingCost(options, subtotalPaise);
  if (!Number.isSafeInteger(subtotalPaise + options.fee + shippingPaise))
    throw new HttpError(409, 'The cart total is too large.');
  if (subtotalPaise < options.minimum) {
    throw new HttpError(
      409,
      'The minimum merchandise subtotal for COD is ' +
        rupees.format(options.minimum / paisePerRupee) +
        '.',
    );
  }
  if (options.maximum !== null && subtotalPaise > options.maximum) {
    throw new HttpError(
      409,
      'The maximum merchandise subtotal for COD is ' +
        rupees.format(options.maximum / paisePerRupee) +
        '.',
    );
  }
  return { delivery, shippingPaise };
}

function createQuoteHash(user, options, shippingPaise, discount, items) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        user,
        options.fee,
        shippingPaise,
        discount.discountCode,
        discount.discountPaise,
        items.map(({ product, quantity, unitPricePaise }) => [product, quantity, unitPricePaise]),
      ]),
    )
    .digest('hex');
}

export async function quoteCart(
  user,
  options,
  { session = null, pin, guest = false, coupon } = {},
) {
  const { lines, productsById } = await readCartProducts(user, session);
  const items = lines.map((line) =>
    priceOrderItem(line, productsById.get(line.product.toString())),
  );
  const subtotalPaise = items.reduce((sum, item) => sum + item.unitPricePaise * item.quantity, 0);
  const { delivery, shippingPaise } = quoteDelivery(options, pin, subtotalPaise);
  const discount = await discountFor({
    user,
    guest,
    coupon,
    subtotal: subtotalPaise,
    options,
    session,
  });
  const totalPaise = subtotalPaise - discount.discountPaise + options.fee + shippingPaise;
  const quote = createQuoteHash(user, options, shippingPaise, discount, items);
  return {
    lines,
    items,
    quote,
    subtotalPaise,
    codFeePaise: options.fee,
    totalPaise,
    shippingPaise,
    ...discount,
    deliveryEstimate: delivery.estimate,
  };
}
