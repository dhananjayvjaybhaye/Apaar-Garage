// Reads reviews and verifies deliveries before updating product ratings transactionally.
import mongoose from 'mongoose';
import { publicProductFilter } from '../utils/product-compliance.js';
import { Product } from '../models/product.js';
import { Order } from '../models/order.js';
import { Review } from '../models/review.js';
import { lockAccount } from './account-write.js';
import { HttpError } from '../utils/http-error.js';

async function productFor(slug) {
  const product = await Product.findOne({ ...publicProductFilter(), slug })
    .select('_id')
    .lean();
  if (!product) throw new HttpError(404, 'Product not found.');
  return product._id;
}

function candidateBuyers({ id, guestId }) {
  return [
    ...new Map([id, guestId].filter(Boolean).map((buyer) => [buyer.toString(), buyer])).values(),
  ];
}

async function verifiedBuyer(buyers, product, session = null) {
  for (const buyer of buyers) {
    if (
      await Order.exists({ user: buyer, status: 'delivered', 'items.product': product }).session(
        session,
      )
    )
      return buyer;
  }
  return null;
}

export async function listReviews(slug, current) {
  const product = await productFor(slug);
  const limit = 8;
  const [items, total] = await Promise.all([
    Review.find({ product })
      .select('rating comment createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((current - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments({ product }),
  ]);
  return {
    items: items.map(({ _id, rating, comment, createdAt }) => ({
      id: _id,
      rating,
      comment,
      createdAt,
    })),
    page: current,
    totalPages: Math.ceil(total / limit),
  };
}

export async function reviewAccess(slug, shopper) {
  const product = await productFor(slug);
  const buyers = candidateBuyers(shopper);
  const reviewed =
    buyers.length > 0 && Boolean(await Review.exists({ product, buyer: { $in: buyers } }));
  const canReview = !reviewed && Boolean(await verifiedBuyer(buyers, product));
  return { canReview, reviewed };
}

export async function submitReview(slug, shopper, { rating, comment }) {
  const product = await productFor(slug);
  const buyers = candidateBuyers(shopper);
  if (!buyers.length) throw new HttpError(403, 'Only verified buyers can submit a review.');
  try {
    return await mongoose.connection.transaction(async (session) => {
      const buyer = await verifiedBuyer(buyers, product, session);
      if (!buyer)
        throw new HttpError(403, 'You can review this model after your order is delivered.');
      if (shopper.user && buyer.toString() === shopper.user._id.toString())
        await lockAccount(buyer, session);
      if (await Review.exists({ product, buyer: { $in: buyers } }).session(session)) {
        throw new HttpError(409, 'You already reviewed this model.');
      }
      await Review.create([{ product, buyer, rating, comment }], { session });
      const updated = await Product.findOneAndUpdate(
        { ...publicProductFilter(), _id: product },
        { $inc: { ratingCount: 1, ratingTotal: rating } },
        { session, returnDocument: 'after', projection: 'ratingCount ratingTotal' },
      ).lean();
      if (!updated) throw new HttpError(404, 'Product not found.');
      return {
        ratingCount: updated.ratingCount,
        ratingAverage: Math.round((updated.ratingTotal * 10) / updated.ratingCount) / 10,
      };
    });
  } catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'You already reviewed this model.');
    throw error;
  }
}
