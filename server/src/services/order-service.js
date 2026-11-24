// Owns checkout and cancellation transactions, including inventory updates.
import { checkoutPolicyVersion } from '../config/store-policy.js';
import { randomBytes } from 'node:crypto';
import { transaction } from './transaction.js';
import { applyStockMovements, restockOrderItems } from './stock.js';
import { priceOrderTax } from './order-tax.js';
import { HttpError } from '../utils/http-error.js';
import { recordAudit } from './audit.js';
import { orderSummary } from './audit-summaries.js';
import { notify } from './notifications.js';
import { assessCod, codIdentity, holdCodLocks, prepareCodLocks, privateKey } from './cod-risk.js';
import { redeemCoupon } from './discounts.js';
import { quoteCart } from './order-quote.js';
import { lockAccount } from './account-write.js';
import { User } from '../models/user.js';
import { CartItem } from '../models/cart-item.js';
import { Order } from '../models/order.js';

export async function placeOrder(user, input, options) {
  const keyFilter = input.checkoutKey ? { user, checkoutKey: input.checkoutKey } : null;
  const keys = codIdentity(input.address, options.riskSecret);
  const customerKey = privateKey(options.riskSecret, 'coupon-phone', input.address.phone);
  const accountKey = input.guest
    ? undefined
    : privateKey(options.riskSecret, 'coupon-account', user.toString());
  await prepareCodLocks(keys);
  if (input.coupon) await options.initializeCoupons();

  try {
    return await transaction(async (session) => {
      if (keyFilter) {
        const existing = await Order.findOne(keyFilter).session(session).lean();
        if (existing) return { order: existing, created: false };
      }

      await holdCodLocks(keys, session);
      // Serialize the first-order eligibility check across concurrent orders for this account.
      if (!input.guest) await lockAccount(user, session);
      const cart = await quoteCart(user, options, {
        session,
        pin: input.address.pincode,
        guest: input.guest,
        coupon: input.coupon,
        customerKey,
        accountKey,
      });
      if (input.quote && input.quote !== cart.quote) {
        throw new HttpError(
          409,
          'Your cart or total changed. Review the updated summary before placing your order.',
        );
      }
      const risk = await assessCod({
        user,
        input,
        keys,
        totalPaise: cart.totalPaise,
        policy: options.risk,
        session,
      });
      const number = 'AG-' + randomBytes(7).toString('hex').toUpperCase();
      await redeemCoupon({
        coupon: input.coupon,
        customerKey,
        accountKey,
        orderNumber: number,
        session,
      });
      await applyStockMovements(
        cart.items.map(({ product, quantity }) => ({ product, delta: -quantity })),
        {
          reason: 'sale',
          order: number,
          actor: user,
          session,
        },
      );
      const tax = priceOrderTax(cart, options.seller, input.address.state);
      const order = new Order({
        number,
        seller: options.seller,
        ...tax,
        ...risk,
        user,
        checkoutKey: input.checkoutKey,
        policyAcceptance: { version: checkoutPolicyVersion, at: new Date() },
        address: input.address,
        subtotalPaise: cart.subtotalPaise,
        codFeePaise: cart.codFeePaise,
        shippingPaise: cart.shippingPaise,
        discountPaise: cart.discountPaise,
        discountCode: cart.discountCode,
        guest: input.guest,
        emailAddress: input.emailAddress,
        emailEvents: [notify(input, 'placed', options)].filter(Boolean),
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
      await recordAudit(
        'order.placed',
        {
          who: input.guest ? undefined : user,
          target: order.number,
          ip: input.auditIp,
          after: orderSummary(order),
        },
        session,
      );
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

export function cancelOrder(
  filter,
  allowed,
  { actor, reasonCode, note, notifications = {}, auditIp } = {},
) {
  return transaction(async (session) => {
    const order = await Order.findOne(filter).select('+emailAddress').session(session);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status === 'cancelled') return order;
    if (!allowed.includes(order.status))
      throw new HttpError(409, 'This order can no longer be cancelled.');

    const at = new Date();
    const notice = notify(order, 'cancelled', notifications, at);
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: order.status },
      {
        $set: {
          status: 'cancelled',
          cancellation: { reasonCode, note, cancelledBy: actor, at },
          ...(order.paymentStatus === 'pending' && { paymentStatus: 'failed' }),
        },
        $push: {
          statusHistory: { status: 'cancelled', at },
          ...(notice && { emailEvents: notice }),
        },
      },
      { session, returnDocument: 'after' },
    );
    if (!updated) throw new HttpError(409, 'The order changed. Reload and try again.');
    await restockOrderItems(order.items, { reason: 'cancel', order: order.number, actor, session });
    await recordAudit(
      'order.cancelled',
      {
        who: actor,
        target: order.number,
        ip: auditIp,
        before: orderSummary(order),
        after: orderSummary(updated),
      },
      session,
    );
    return updated;
  });
}
