// Owns checkout and cancellation transactions, including inventory updates.
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { HttpError } from '../utils/http-error.js';
import { orderEmailEvent } from './order-email.js';
import { quoteCart, stockError } from './order-quote.js';
import { User } from '../models/user.js';
import { CartItem } from '../models/cart-item.js';
import { Order } from '../models/order.js';
import { Product } from '../models/product.js';

async function transaction(action) {
  try {
    return await mongoose.connection.transaction(action, {
      readPreference: 'primary',
    });
  } catch (error) {
    if (error.code === 20 && /transaction/i.test(error.message)) {
      throw new HttpError(503, 'Checkout requires a MongoDB replica set or sharded cluster.');
    }
    throw error;
  }
}

export async function placeOrder(user, input, options) {
  const keyFilter = input.checkoutKey ? { user, checkoutKey: input.checkoutKey } : null;
  try {
    return await transaction(async (session) => {
      if (keyFilter) {
        const existing = await Order.findOne(keyFilter).session(session).lean();
        if (existing) return { order: existing, created: false };
      }

      // Serialize the first-order eligibility check across concurrent orders for this account.
      if (!input.guest && options.firstOrderPercent) {
        await User.updateOne({ _id: user }, { $inc: { checkoutVersion: 1 } }, { session });
      }
      const cart = await quoteCart(user, options, {
        session,
        pin: input.address.pincode,
        guest: input.guest,
        coupon: input.coupon,
      });
      if (input.quote && input.quote !== cart.quote) {
        throw new HttpError(
          409,
          'Your cart or total changed. Review the updated summary before placing your order.',
        );
      }
      const inventory = await Product.bulkWrite(
        cart.items.map((item) => ({
          updateOne: {
            filter: { _id: item.product, stock: { $gte: item.quantity } },
            update: { $inc: { stock: -item.quantity, sales: item.quantity } },
          },
        })),
        { session },
      );
      if (inventory.matchedCount !== cart.items.length) throw stockError();

      const order = new Order({
        number: 'AG-' + randomBytes(7).toString('hex').toUpperCase(),
        user,
        checkoutKey: input.checkoutKey,
        address: input.address,
        items: cart.items,
        subtotalPaise: cart.subtotalPaise,
        codFeePaise: cart.codFeePaise,
        shippingPaise: cart.shippingPaise,
        discountPaise: cart.discountPaise,
        discountCode: cart.discountCode,
        guest: input.guest,
        emailAddress: input.emailAddress,
        emailEvents:
          options.orderEmailEnabled && input.emailAddress ? [orderEmailEvent('confirmed')] : [],
        totalPaise: cart.totalPaise,
        deliveryEstimate: cart.deliveryEstimate,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        status: 'placed',
      });
      await order.save({ session });
      const removed = await CartItem.deleteMany(
        { user, _id: { $in: cart.lines.map((line) => line._id) } },
        { session },
      );
      if (removed.deletedCount !== cart.lines.length) {
        throw new HttpError(409, 'Your cart changed. Review it and try again.');
      }
      if (input.saveAddress && !input.guest) {
        await User.updateOne(
          {
            _id: user,
            'savedAddresses.9': { $exists: false },
            savedAddresses: { $not: { $elemMatch: input.address } },
          },
          { $push: { savedAddresses: input.address } },
          { session },
        );
      }
      return { order, created: true };
    });
  } catch (error) {
    if (keyFilter && error.code === 11000) {
      const existing = await Order.findOne(keyFilter).lean();
      if (existing) return { order: existing, created: false };
    }
    throw error;
  }
}

export function cancelOrder(filter, allowed) {
  return transaction(async (session) => {
    const order = await Order.findOne(filter).session(session);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status === 'cancelled') return order;
    if (!allowed.includes(order.status))
      throw new HttpError(409, 'This order can no longer be cancelled.');

    order.status = 'cancelled';
    order.statusHistory.push({ status: 'cancelled', at: new Date() });
    if (order.paymentStatus === 'pending') order.paymentStatus = 'failed';
    await order.save({ session });
    await Product.bulkWrite(
      order.items.map((item) => ({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { stock: item.quantity } },
        },
      })),
      { session },
    );
    await Product.bulkWrite(
      order.items.map((item) => ({
        updateOne: {
          filter: { _id: item.product, sales: { $gte: item.quantity } },
          update: { $inc: { sales: -item.quantity } },
        },
      })),
      { session },
    );
    return order;
  });
}
