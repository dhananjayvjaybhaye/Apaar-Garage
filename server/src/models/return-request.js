import mongoose from 'mongoose';
import { returnReasons, returnStatuses, stockConditions } from '../config/business.js';
import { nonnegativePaise } from './order-business-fields.js';

const objectId = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true },
    items: [
      {
        _id: false,
        product: { type: objectId, ref: 'Product', required: true },
        slug: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
        maximumRefundPaise: nonnegativePaise,
        condition: { type: String, enum: stockConditions },
      },
    ],
    reason: { type: String, enum: returnReasons, required: true },
    status: { type: String, enum: returnStatuses, default: 'requested', required: true },
    resolution: { type: String, enum: ['refund', 'replacement'] },
    maximumRefundPaise: nonnegativePaise,
    refundAmountPaise: { ...nonnegativePaise, default: 0 },
    notes: [{ _id: false, note: String, actor: objectId, at: Date, internal: Boolean }],
    receivedAt: Date,
    resolvedAt: Date,
  },
  { timestamps: true },
);

schema.index({ orderNumber: 1, status: 1 });
schema.index({ createdAt: -1, _id: -1 });
export const ReturnRequest = mongoose.model('ReturnRequest', schema);
