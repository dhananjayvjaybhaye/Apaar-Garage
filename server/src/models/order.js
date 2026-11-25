import mongoose from 'mongoose';
import { notificationEvents } from '../config/store-policy.js';
import { orderStatuses } from '../config/business.js';
import { itemBusinessFields, orderBusinessFields } from './order-business-fields.js';

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false },
);

const itemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
    },
    ...itemBusinessFields,
    slug: { type: String, required: true },
    name: { type: String, required: true },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
      validate: Number.isSafeInteger,
    },
    unitPricePaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
  },
  { _id: false },
);

const money = {
  type: Number,
  required: true,
  min: 0,
  validate: Number.isSafeInteger,
};
const schema = new mongoose.Schema(
  {
    ...orderBusinessFields,
    number: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    checkoutKey: String,
    emailAddress: { type: String, select: false },
    emailEvents: [
      {
        _id: false,
        kind: { type: String, enum: notificationEvents },
        attempts: { type: Number, default: 0 },
        nextAttemptAt: Date,
        lease: String,
        sentAt: Date,
        failedAt: Date,
      },
    ],
    address: { type: addressSchema, required: true },
    items: {
      type: [itemSchema],
      required: true,
      validate: (items) => items.length > 0,
    },
    subtotalPaise: money,
    codFeePaise: money,
    discountPaise: { ...money, default: 0 },
    discountCode: String,
    shippingPaise: { ...money, default: 0 },
    guest: { type: Boolean, default: false },
    statusHistory: [{ _id: false, status: { type: String, enum: orderStatuses }, at: Date }],
    totalPaise: money,
    deliveryEstimate: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: orderStatuses,
      default: 'placed',
    },
    paymentMethod: { type: String, required: true, enum: ['cod', 'online'] },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['pending', 'collected', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

schema.index({ user: 1, createdAt: -1, _id: -1 });
schema.index({ createdAt: -1, _id: -1 });
schema.index({ totalPaise: -1, _id: -1 });
schema.index({ 'risk.phoneKey': 1, createdAt: -1 }, { sparse: true });
schema.index({ 'risk.addressKey': 1, createdAt: -1 }, { sparse: true });
schema.index({ 'address.phone': 1, createdAt: -1 }, { sparse: true });
schema.index({ 'address.pincode': 1, createdAt: -1 }, { sparse: true });
schema.index({ purgeAfter: 1 }, { expireAfterSeconds: 0 });
schema.index({ user: 1, status: 1, 'items.product': 1 });
schema.index({ 'emailEvents.nextAttemptAt': 1 }, { sparse: true });
schema.index(
  { user: 1, checkoutKey: 1 },
  {
    unique: true,
    partialFilterExpression: { checkoutKey: { $type: 'string' } },
  },
);
export const Order = mongoose.model('Order', schema);
