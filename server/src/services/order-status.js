// Updates admin order states and schedules the existing order status emails.
import { Order } from '../models/order.js';
import { HttpError } from '../utils/http-error.js';
import { orderEmailEvent } from './order-email.js';
import { cancelOrder } from './order-service.js';

const transitions = {
  placed: ['confirmed'],
  confirmed: ['packed'],
  packed: ['shipped'],
  shipped: ['delivered'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

export async function changeOrderStatus(orderNumber, status, options) {
  if (status === 'cancelled')
    return cancelOrder({ number: orderNumber }, ['placed', 'confirmed', 'packed']);
  const order = await Order.findOne({ number: orderNumber }).select('+emailAddress').lean();
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.status === status) return order;
  if (!transitions[order.status].includes(status)) {
    throw new HttpError(409, 'That order status transition is not allowed.');
  }
  const queueEmail =
    options.orderEmailEnabled && order.emailAddress && ['shipped', 'delivered'].includes(status);
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    {
      $set: { status },
      $push: {
        statusHistory: { status, at: new Date() },
        ...(queueEmail && { emailEvents: orderEmailEvent(status) }),
      },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw new HttpError(409, 'The order changed. Reload and try again.');
  return updated;
}

export async function collectOrderPayment(orderNumber) {
  const order = await Order.findOneAndUpdate(
    { number: orderNumber, status: 'delivered', paymentMethod: 'cod' },
    { $set: { paymentStatus: 'collected' } },
    { returnDocument: 'after' },
  ).lean();
  if (!order) {
    if (!(await Order.exists({ number: orderNumber })))
      throw new HttpError(404, 'Order not found.');
    throw new HttpError(409, 'Mark COD collected only after delivery.');
  }
  return order;
}
