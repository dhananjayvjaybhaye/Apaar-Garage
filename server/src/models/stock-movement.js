import mongoose from 'mongoose';
import { stockReasons } from '../config/business.js';

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  delta: {
    type: Number,
    required: true,
    validate: (value) => Number.isSafeInteger(value) && value !== 0,
  },
  reason: { type: String, enum: stockReasons, required: true },
  order: String,
  adjustmentReason: String,
  actor: mongoose.Schema.Types.ObjectId,
  at: { type: Date, default: Date.now, required: true },
});

schema.index({ product: 1, at: -1 });
schema.index({ order: 1, reason: 1 });
export const StockMovement = mongoose.model('StockMovement', schema);
