import { z } from 'zod';
import { Order } from '../models/order.js';
import { User } from '../models/user.js';

export const adminPageSize = 25;
export const adminPage = z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default(1);
export const adminSearch = z.string().trim().max(100).optional();

export function literalSearch(q) {
  return new RegExp(RegExp.escape(q), 'i');
}

export function pageResult(items, page, total, size = adminPageSize) {
  return { items, page, total, totalPages: Math.ceil(total / size) };
}

export async function directoryPage(model, filter, projection, sort, page, size = adminPageSize) {
  const [items, total] = await Promise.all([
    model.find(filter).select(projection).sort(sort).skip((page - 1) * size).limit(size).lean(),
    model.countDocuments(filter),
  ]);
  return pageResult(items, page, total, size);
}

export async function customerDirectory({ q, page }) {
  const term = q ? literalSearch(q) : undefined;
  const filter = { role: 'customer', ...(term && { $or: [{ name: term }, { email: term }] }) };
  const [items, total] = await Promise.all([
    User.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      { $skip: (page - 1) * adminPageSize },
      { $limit: adminPageSize },
      { $project: { name: 1, email: 1, createdAt: 1 } },
      { $lookup: {
        from: Order.collection.name,
        localField: '_id',
        foreignField: 'user',
        as: 'totals',
        pipeline: [{ $group: {
          _id: null,
          orderCount: { $sum: 1 },
          orderedPaise: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$totalPaise', 0] } },
          collectedPaise: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'collected'] }, '$totalPaise', 0] } },
        } }],
      } },
      { $project: {
        name: 1, email: 1, createdAt: 1,
        orderCount: { $ifNull: [{ $first: '$totals.orderCount' }, 0] },
        orderedPaise: { $ifNull: [{ $first: '$totals.orderedPaise' }, 0] },
        collectedPaise: { $ifNull: [{ $first: '$totals.collectedPaise' }, 0] },
      } },
    ]),
    User.countDocuments(filter),
  ]);
  return pageResult(items, page, total);
}
