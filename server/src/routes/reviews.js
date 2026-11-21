import { Router } from 'express';
import { getReviewAccess, getReviews, postReview } from '../controllers/reviews.js';

export function createReviewsRouter(shopper) {
  const router = Router();
  router.get('/:slug/reviews', getReviews);
  router.get('/:slug/review-access', shopper, getReviewAccess);
  router.post('/:slug/reviews', shopper, postReview);
  return router;
}
