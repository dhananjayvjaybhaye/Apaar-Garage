// Stores account wishlist entries and maps saved addresses to their public shape.
import { User } from '../models/user.js';
import { publicProductFilter } from '../utils/product-compliance.js';
import { Product } from '../models/product.js';
import { HttpError } from '../utils/http-error.js';

const maximumWishlistItems = 100;

export async function readWishlist(userId) {
  const user = await User.findById(userId).select('wishlist').lean();
  const slugs = user?.wishlist ?? [];
  const visible = new Set(
    await Product.distinct('slug', { ...publicProductFilter(), slug: { $in: slugs } }),
  );
  return slugs.filter((slug) => visible.has(slug));
}

export async function addWishlistItem(userId, slug) {
  if (!(await Product.exists({ ...publicProductFilter(), slug })))
    throw new HttpError(404, 'Product not found.');
  const lastAllowedEntry = 'wishlist.' + (maximumWishlistItems - 1);
  const updated = await User.updateOne(
    { _id: userId, $or: [{ wishlist: slug }, { [lastAllowedEntry]: { $exists: false } }] },
    { $addToSet: { wishlist: slug } },
  );
  if (!updated.matchedCount) throw new HttpError(409, 'Your wishlist holds up to 100 items.');
}

export function removeWishlistItem(userId, slug) {
  return User.updateOne({ _id: userId }, { $pull: { wishlist: slug } });
}

export async function readAddresses(userId) {
  const user = await User.findById(userId).select('savedAddresses').lean();
  return (user?.savedAddresses ?? []).map(({ _id, ...address }) => ({ ...address, id: _id }));
}
