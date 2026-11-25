import { Product } from '../models/product.js';
import { Order } from '../models/order.js';
import { ReturnRequest } from '../models/return-request.js';
import { SupportRequest } from '../models/support-request.js';
import { millisecondsPerDay } from '../config/business.js';
import {
  dashboardDays,
  defaultLowStock,
  indiaOffsetMinutes,
  indiaTimeZone,
  ticketDueSoonHours,
  topSellerLimit,
} from '../config/admin-panel.js';

const dateFormat = '%Y-%m-%d';
const indiaOffsetMs = indiaOffsetMinutes * 60_000;
const openOrderStates = ['placed', 'confirmed'];
const openReturnStates = ['requested', 'approved', 'received'];

export const lowStockFilter = {
  stock: { $gt: 0 },
  $expr: { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', defaultLowStock] }] },
};

function salesPeriod(now) {
  const today = new Date(+now + indiaOffsetMs);
  today.setUTCHours(0, 0, 0, 0);
  const firstDay = +today - (dashboardDays - 1) * millisecondsPerDay;
  return {
    start: new Date(firstDay - indiaOffsetMs),
    dates: Array.from({ length: dashboardDays }, (_, day) =>
      new Date(firstDay + day * millisecondsPerDay).toISOString().slice(0, 10),
    ),
  };
}

async function orderMetrics(now) {
  const { start, dates } = salesPeriod(now);
  const [counts, sales] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $in: ['placed', 'confirmed', 'delivered', 'undelivered'] } } },
      {
        $group: {
          _id: null,
          ordersToConfirm: { $sum: { $cond: [{ $eq: ['$status', 'placed'] }, 1, 0] } },
          codToCollect: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'delivered'] },
                    { $eq: ['$paymentStatus', 'pending'] },
                    { $eq: ['$paymentMethod', 'cod'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          riskOrders: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', openOrderStates] },
                    { $eq: ['$needsConfirmation', true] },
                    { $ne: ['$customerConfirmation.status', 'confirmed'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          undelivered: { $sum: { $cond: [{ $eq: ['$status', 'undelivered'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now }, paymentStatus: 'collected' } },
      {
        $facet: {
          daily: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    date: '$createdAt',
                    format: dateFormat,
                    timezone: indiaTimeZone,
                  },
                },
                totalPaise: { $sum: '$totalPaise' },
              },
            },
          ],
          top: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.slug',
                name: { $last: '$items.name' },
                quantity: { $sum: '$items.quantity' },
              },
            },
            { $sort: { quantity: -1, _id: 1 } },
            { $limit: topSellerLimit },
          ],
        },
      },
    ]),
  ]);
  const byDate = new Map(sales[0]?.daily.map(({ _id, totalPaise }) => [_id, totalPaise]) ?? []);
  return {
    counts: { ordersToConfirm: 0, codToCollect: 0, riskOrders: 0, undelivered: 0, ...counts[0] },
    sales: dates.map((date) => ({ date, totalPaise: byDate.get(date) ?? 0 })),
    topSellers: (sales[0]?.top ?? []).map(({ _id, ...item }) => ({ slug: _id, ...item })),
  };
}

export async function adminDashboard(now = new Date()) {
  const deadline = new Date(+now + ticketDueSoonHours * 60 * 60_000);
  const inventory = { status: 'published' };
  const [orders, openReturns, ticketsDueSoon, lowStock, soldOut] = await Promise.all([
    orderMetrics(now),
    ReturnRequest.countDocuments({ status: { $in: openReturnStates } }),
    SupportRequest.countDocuments({
      anonymizedAt: { $exists: false },
      $or: [
        { status: 'open', acknowledgeBy: { $lte: deadline } },
        { status: { $in: ['open', 'acknowledged'] }, dueAt: { $lte: deadline } },
      ],
    }),
    Product.countDocuments({ ...inventory, ...lowStockFilter }),
    Product.countDocuments({ ...inventory, stock: 0 }),
  ]);
  return {
    ...orders,
    counts: { ...orders.counts, openReturns, ticketsDueSoon, lowStock, soldOut },
  };
}
