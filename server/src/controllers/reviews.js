// Validates review submissions and preserves the response cache policy for each endpoint.
import { z } from 'zod';
import { validate } from '../utils/http-error.js';
import { listReviews, reviewAccess, submitReview } from '../services/reviews.js';

const body = z.strictObject({
  rating: z.int().min(1).max(5),
  comment: z.string().trim().min(1, 'Write a short review.').max(1000),
});
const page = z
  .string()
  .regex(/^[1-9]\d{0,4}$/)
  .transform(Number)
  .default(1);

export async function getReviews(req, res) {
  const reviews = await listReviews(req.params.slug, validate(page, req.query.page));
  res.set('Cache-Control', 'public, no-cache').json(reviews);
}

export async function getReviewAccess(req, res) {
  const access = await reviewAccess(req.params.slug, res.locals.shopper);
  res.set('Cache-Control', 'no-store').json(access);
}

export async function postReview(req, res) {
  const review = await submitReview(req.params.slug, res.locals.shopper, validate(body, req.body));
  res.set('Cache-Control', 'no-store').status(201).json(review);
}
