// Prices the cart and creates a quote that can be verified again inside checkout.
import { createHash } from 'node:crypto';
import { CartItem } from '../models/cart-item.js';
import { publicProductFilter } from '../utils/product-compliance.js';
import { Product } from '../models/product.js';
import { HttpError } from '../utils/http-error.js';
import { paisePerRupee, toPaise } from '../utils/commerce.js';
import { priceOrderTax } from './order-tax.js';
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

export class EmptyCartError extends HttpError {
  constructor() {
    super(409, 'Your cart is empty.');
  }
}

async function readCartProducts(user, session) {
  if (!user) throw new EmptyCartError();
  const lines = await CartItem.find({ user }).sort({ _id: 1 }).session(session).lean();
  if (!lines.length) throw new EmptyCartError();

  const products = await Product.find({
    ...publicProductFilter(),
    _id: { $in: lines.map((line) => line.product) },
  })
    .select('slug name price stock sku hsnCode gstRatePercent mrp returnWindowDays')
    .session(session)
    .lean();
  return {
    lines,
    productsById: new Map(products.map((product) => [product._id.toString(), product])),
  };
}

function priceOrderItem(line, product, options) {
  if (!product) throw new HttpError(409, 'A product in your cart is no longer available.');
  if (product.stock < line.quantity) throw stockError(product.name);
  const unitPricePaise = toPaise(product.price);
  if (
    !Number.isSafeInteger(unitPricePaise) ||
    unitPricePaise < 0 ||
    !Number.isSafeInteger(toPaise(product.mrp ?? product.price))
  ) {
    throw new HttpError(409, 'A price is unavailable for ' + product.name + '.');
  }
  return {
    product: product._id,
    slug: product.slug,
    name: product.name,
    quantity: line.quantity,
    unitPricePaise,
    sku: product.sku,
    hsn: product.hsnCode,
    gstRatePercent: product.gstRatePercent ?? 0,
    mrpPaise: toPaise(product.mrp ?? product.price),
    returnWindowDays: product.returnWindowDays ?? options.defaultReturnWindowDays,
  };
}

function quoteDelivery(options, pin, subtotalPaise) {
  const delivery = deliveryFor(options, pin);
  if (!delivery.cod) throw new HttpError(409, 'Cash on Delivery is unavailable for this pincode.');
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
  return delivery;
}

function createQuoteHash(user, options, shippingPaise, discount, items) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        user,
        options.fee,
        options.seller,
        shippingPaise,
        discount.discountCode,
        discount.discountPaise,
        items,
      ]),
    )
    .digest('hex');
}

export async function quoteCart(
  user,
  options,
  { session = null, pin, guest = false, coupon, customerKey, accountKey } = {},
) {
  const { lines, productsById } = await readCartProducts(user, session);
  const items = lines.map((line) =>
    priceOrderItem(line, productsById.get(line.product.toString()), options),
  );
  const subtotalPaise = items.reduce((sum, item) => sum + item.unitPricePaise * item.quantity, 0);
  if (!Number.isSafeInteger(subtotalPaise))
    throw new HttpError(409, 'The cart total is too large.');
  const delivery = quoteDelivery(options, pin, subtotalPaise);
  const discount = await discountFor({
    user,
    guest,
    coupon,
    customerKey,
    accountKey,
    subtotal: subtotalPaise,
    options,
    session,
  });
  const netMerchandisePaise = Math.max(0, subtotalPaise - discount.discountPaise);
  const shippingPaise = shippingCost(options, netMerchandisePaise);
  const totalPaise = netMerchandisePaise + options.fee + shippingPaise;
  if (!Number.isSafeInteger(totalPaise)) throw new HttpError(409, 'The cart total is too large.');
  const taxPaise = options.seller.gstRegistered
    ? priceOrderTax(
        { items, subtotalPaise, ...discount },
        options.seller,
        options.seller.state,
      ).items.reduce((sum, item) => sum + item.taxPaise, 0)
    : null;
  const quote = createQuoteHash(user, options, shippingPaise, discount, items);
  return {
    lines,
    items,
    quote,
    subtotalPaise,
    codFeePaise: options.fee,
    totalPaise,
    taxPaise,
    shippingPaise,
    ...discount,
    deliveryEstimate: delivery.estimate,
  };
}
