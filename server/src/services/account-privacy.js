import mongoose from 'mongoose';
import { accountClosedName } from '../config/store-policy.js';
import { millisecondsPerDay } from '../config/business.js';
import { CartItem } from '../models/cart-item.js';
import { CouponRedemption } from '../models/coupon.js';
import { NewsletterSubscriber } from '../models/newsletter-subscriber.js';
import { Order } from '../models/order.js';
import { ReturnRequest } from '../models/return-request.js';
import { Review } from '../models/review.js';
import { StockMovement } from '../models/stock-movement.js';
import { SupportRequest } from '../models/support-request.js';
import { HttpError } from '../utils/http-error.js';
import { transaction } from './transaction.js';
import { User } from '../models/user.js';

const terminalOrders = ['delivered', 'cancelled', 'returned', 'returned_to_seller'];
const openReturns = ['requested', 'approved', 'received'];

async function findAccountData(user) {
  const [account, orders, cart, reviews, tickets, subscription] = await Promise.all([
    User.findById(user).select('name email wishlist savedAddresses createdAt').lean(),
    Order.find({ user })
      .select(
        'number address items seller taxBreakup invoiceNumber invoiceType policyAcceptance status createdAt totalPaise paymentStatus paymentMethod +emailAddress',
      )
      .lean(),
    CartItem.find({ user }).select('product quantity').lean(),
    Review.find({ buyer: user }).select('product rating comment createdAt').lean(),
    SupportRequest.find({ account: user }).select('-account -__v').lean(),
    NewsletterSubscriber.findOne({ account: user })
      .select('consent subscribedAt unsubscribedAt')
      .lean(),
  ]);
  if (!account) throw new HttpError(404, 'Account not found.');
  const requests = await ReturnRequest.find({
    orderNumber: { $in: orders.map(({ number }) => number) },
  })
    .select(
      'orderNumber items.slug items.quantity items.condition reason status resolution refundAmountPaise notes createdAt updatedAt',
    )
    .lean();
  const returns = requests.map(({ notes, ...entry }) => ({
    ...entry,
    notes: notes.filter(({ internal }) => !internal).map(({ note, at }) => ({ note, at })),
  }));
  return { account, orders, cart, reviews, tickets, subscription, returns };
}

export function exportAccount(user) {
  return findAccountData(user);
}

async function anonymizeOrders(user, orders, at, days, session) {
  if (!orders.length) return;
  await Order.bulkWrite(
    orders.map(({ _id, createdAt }) => ({
      updateOne: {
        filter: { _id, user },
        update: {
          $set: {
            user: new mongoose.Types.ObjectId(),
            address: { fullName: accountClosedName },
            anonymizedAt: at,
            purgeAfter: new Date(Math.max(+at, +createdAt + days * millisecondsPerDay)),
            emailEvents: [],
            adminNotes: [],
          },
          $unset: {
            emailAddress: 1,
            risk: 1,
            checkoutKey: 1,
            'shipment.awb': 1,
            'shipment.trackingUrl': 1,
            'shipment.undeliveredNote': 1,
            'cancellation.note': 1,
            'cancellation.reasonCode': 1,
            'cancellation.cancelledBy': 1,
            'customerConfirmation.by': 1,
          },
        },
      },
    })),
    { session },
  );
  await ReturnRequest.updateMany(
    { orderNumber: { $in: orders.map(({ number }) => number) } },
    { $set: { notes: [] } },
    { session },
  );
}

async function scrubRelatedRecords(user, orders, at, session) {
  // Keep review scores and unlink the author. Clearing the text removes any personal details.
  const reviews = await Review.find({ buyer: user }).select('_id').session(session).lean();
  if (reviews.length)
    await Review.bulkWrite(
      reviews.map(({ _id }) => ({
        updateOne: {
          filter: { _id },
          update: {
            $set: {
              buyer: new mongoose.Types.ObjectId(),
              comment: 'Review by a deleted customer.',
            },
          },
        },
      })),
      { session },
    );
  await CartItem.deleteMany({ user }, { session });
  await NewsletterSubscriber.deleteMany({ account: user }, { session });
  await SupportRequest.updateMany(
    { account: user },
    {
      $set: { message: accountClosedName, replies: [], anonymizedAt: at },
      $unset: { account: 1, email: 1, name: 1, phone: 1 },
    },
    { session },
  );
  await StockMovement.updateMany({ actor: user }, { $unset: { actor: 1 } }, { session });
  await CouponRedemption.updateMany(
    { orderNumber: { $in: orders.map(({ number }) => number) } },
    { $set: { customerKey: new mongoose.Types.ObjectId().toString() }, $unset: { accountKey: 1 } },
    { session },
  );
}

export function deleteAccount(user, days) {
  return transaction(async (session) => {
    // The same account document is written during signed-in checkout.
    const account = await User.findOneAndUpdate(
      { _id: user },
      { $inc: { checkoutVersion: 1 } },
      { session },
    );
    if (!account) throw new HttpError(404, 'Account not found.');
    const orders = await Order.find({ user })
      .select('number status createdAt')
      .session(session)
      .lean();
    if (
      orders.some(({ status }) => !terminalOrders.includes(status)) ||
      (await ReturnRequest.exists({
        orderNumber: { $in: orders.map(({ number }) => number) },
        status: { $in: openReturns },
      }).session(session))
    ) {
      throw new HttpError(
        409,
        'Please wait for your open orders and returns to finish before closing your account.',
      );
    }
    const at = new Date();
    await anonymizeOrders(user, orders, at, days, session);
    await scrubRelatedRecords(user, orders, at, session);
    await User.deleteOne({ _id: user }, { session });
  });
}
