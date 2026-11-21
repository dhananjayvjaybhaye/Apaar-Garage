// Handles the authenticated wishlist and address endpoints.
import { z } from 'zod';
import { validate } from '../utils/http-error.js';
import {
  addWishlistItem,
  readAddresses,
  readWishlist,
  removeWishlistItem,
} from '../services/shop-account.js';

const productSlug = z
  .string()
  .max(150)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export async function getWishlist(_req, res) {
  res.json(await readWishlist(res.locals.user._id));
}

export async function addToWishlist(req, res) {
  await addWishlistItem(res.locals.user._id, validate(productSlug, req.params.slug));
  res.sendStatus(204);
}

export async function removeFromWishlist(req, res) {
  await removeWishlistItem(res.locals.user._id, validate(productSlug, req.params.slug));
  res.sendStatus(204);
}

export async function getAddresses(_req, res) {
  res.json(await readAddresses(res.locals.user._id));
}
