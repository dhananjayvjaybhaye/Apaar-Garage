// Validates cart requests and returns the refreshed cart after every mutation.
import { z } from 'zod';
import { writeForAccount } from '../services/account-write.js';
import { commerceOptions } from '../services/store-settings.js';
import { validate } from '../utils/http-error.js';
import { maxCartQuantity } from '../utils/commerce.js';
import {
  addCartItem,
  readCart,
  removeCartItem,
  removeUnavailableItems,
  updateCartItem,
} from '../services/cart.js';

const slug = z
  .string()
  .max(150)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid product slug.');
const quantityBody = z.strictObject({
  quantity: z
    .int()
    .min(1, 'Quantity must be at least 1.')
    .max(maxCartQuantity, 'Quantity must be 99 or fewer.'),
});
const addBody = quantityBody.extend({ slug });

export function createCartController(options) {
  return {
    async list(_req, res) {
      res.json(await readCart(res.locals.shopper.id, await commerceOptions(options)));
    },
    async add(req, res) {
      const input = validate(addBody, req.body);
      const { id, user } = res.locals.shopper;
      await writeForAccount(user?._id, (session) => addCartItem(id, input, session));
      res.json(await readCart(id, await commerceOptions(options)));
    },
    async update(req, res) {
      const productSlug = validate(slug, req.params.slug);
      const input = validate(quantityBody, req.body);
      const { id } = res.locals.shopper;
      await updateCartItem(id, productSlug, input);
      res.json(await readCart(id, await commerceOptions(options)));
    },
    async removeUnavailable(_req, res) {
      const { id } = res.locals.shopper;
      await removeUnavailableItems(id);
      res.json(await readCart(id, await commerceOptions(options)));
    },
    async remove(req, res) {
      const productSlug = validate(slug, req.params.slug);
      const { id } = res.locals.shopper;
      await removeCartItem(id, productSlug);
      res.json(await readCart(id, await commerceOptions(options)));
    },
  };
}
