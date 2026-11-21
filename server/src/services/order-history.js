// Finds orders while preserving the distinction between authenticated and guest access.
import { Order } from '../models/order.js';
import { HttpError } from '../utils/http-error.js';
import { publicOrder } from '../utils/order-response.js';

const ordersPerPage = 12;

export function ownedOrderFilter(orderNumber, { id, guestId }) {
  return { number: orderNumber, user: { $in: [id, guestId].filter(Boolean) } };
}

export async function findCustomerOrder(filter) {
  const order = await Order.findOne(filter).lean();
  if (!order) throw new HttpError(404, 'Order not found.');
  return order;
}

export async function listCustomerOrders(user, page) {
  const filter = { user };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * ordersPerPage)
      .limit(ordersPerPage)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items: orders.map(publicOrder), page, totalPages: Math.ceil(total / ordersPerPage) };
}
