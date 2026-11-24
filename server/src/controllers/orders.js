// Validates order requests and maps order results to their existing HTTP contracts.
import { z } from 'zod';
import { commerceOptions } from '../services/store-settings.js';
import { privateKey } from '../services/cod-risk.js';
import { indianPhone } from '../utils/indian-phone.js';
import { HttpError, validate } from '../utils/http-error.js';
import { pincode } from '../services/delivery.js';
import { couponCode } from '../services/discounts.js';
import {
  cancellationInput,
  orderNumberPattern,
  orderTransition,
} from '../utils/order-business-input.js';
import { cancelOrder, placeOrder } from '../services/order-service.js';
import { EmptyCartError, quoteCart } from '../services/order-quote.js';
import { customerCancellable, publicItems, publicOrder } from '../utils/order-response.js';
import {
  findCustomerOrder,
  listCustomerOrders,
  ownedOrderFilter,
} from '../services/order-history.js';
import { changeOrderStatus, collectOrderPayment } from '../services/order-status.js';

const field = (label, max) =>
  z
    .string()
    .trim()
    .min(1, 'Enter ' + label + '.')
    .max(max);
const address = z.strictObject({
  fullName: field('your full name', 100),
  phone: indianPhone,
  addressLine1: field('your street address', 160),
  addressLine2: z.string().trim().max(160).optional(),
  city: field('your city', 80),
  state: field('your state or union territory', 80),
  pincode,
});
const checkout = z.strictObject({
  address,
  acceptPolicies: z.literal(true, 'Accept the store terms and policies before placing your order.'),
  paymentMethod: z.enum(['cod', 'online']).default('cod'),
  quote: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  checkoutKey: z.uuid().optional(),
  saveAddress: z.boolean().optional(),
  coupon: couponCode.optional(),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()).optional(),
});
const pageQuery = z.object({
  page: z
    .string()
    .regex(/^[1-9]\d{0,5}$/)
    .transform(Number)
    .default(1),
});
const collection = z.strictObject({ paymentStatus: z.literal('collected') });
const allowEmptyQuote = z.literal('ok').optional();

function validateOnlinePayment(input, options) {
  if (input.paymentMethod !== 'online') return;
  if (!options.onlineEnabled)
    throw new HttpError(400, 'Online payment is disabled. Choose Cash on Delivery.');
  throw new HttpError(503, 'Online payment is unavailable. Choose Cash on Delivery.');
}

function orderFilter(req, res) {
  return ownedOrderFilter(validate(orderNumberPattern, req.params.orderNumber), res.locals.shopper);
}

export function createOrdersController(options) {
  return {
    async place(req, res) {
      const input = validate(checkout, req.body);
      validateOnlinePayment(input, options);
      const { id, user } = res.locals.shopper;
      const { order, created } = await placeOrder(
        id,
        {
          ...input,
          guest: !user,
          emailAddress: user?.email ?? input.email,
        },
        await commerceOptions(options),
      );
      res.status(created ? 201 : 200).json({ orderNumber: order.number });
    },
    async quote(req, res) {
      const pin = validate(pincode.optional(), req.query.pincode);
      const coupon = validate(couponCode.optional(), req.query.coupon);
      const empty = validate(allowEmptyQuote, req.query.empty);
      const { id, user } = res.locals.shopper;
      const current = await commerceOptions(options);
      if (coupon) await options.initializeCoupons();
      let result;
      try {
        result = await quoteCart(id, current, {
          pin,
          coupon,
          guest: !user,
          accountKey: user
            ? privateKey(options.riskSecret, 'coupon-account', id.toString())
            : undefined,
        });
      } catch (error) {
        if (empty === 'ok' && error instanceof EmptyCartError) return res.json({ empty: true });
        throw error;
      }
      const { lines: _lines, items, ...quote } = result;
      res.json({
        ...quote,
        items: publicItems(items),
        paymentMethod: 'cod',
        emailUpdates: options.orderEmailEnabled,
        firstOrderPercent: current.firstOrderPercent,
      });
    },
    async list(req, res) {
      const { page } = validate(pageQuery, req.query);
      res.json(await listCustomerOrders(res.locals.user._id, page));
    },
    async find(req, res) {
      res.json(publicOrder(await findCustomerOrder(orderFilter(req, res))));
    },
    async cancel(req, res) {
      const { reasonCode = 'customer_cancelled', note } = validate(
        cancellationInput,
        req.body ?? {},
      );
      res.json(
        publicOrder(
          await cancelOrder(orderFilter(req, res), customerCancellable, {
            reasonCode,
            note,
            actor: res.locals.shopper.id,
            notifications: options,
          }),
        ),
      );
    },
    async changeStatus(req, res) {
      const orderNumber = validate(orderNumberPattern, req.params.orderNumber);
      const input = validate(orderTransition, req.body);
      res.json(
        publicOrder(
          await changeOrderStatus(
            orderNumber,
            input,
            await commerceOptions(options),
            res.locals.user._id,
          ),
        ),
      );
    },
    async collectPayment(req, res) {
      const orderNumber = validate(orderNumberPattern, req.params.orderNumber);
      validate(collection, req.body);
      res.json(publicOrder(await collectOrderPayment(orderNumber)));
    },
  };
}
