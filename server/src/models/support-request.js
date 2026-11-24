import mongoose from 'mongoose';
import { supportCategories, ticketStatuses } from '../config/store-policy.js';

const schema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, sparse: true },
    account: { type: mongoose.Schema.Types.ObjectId, index: true },
    name: String,
    email: { type: String, required: true },
    phone: String,
    orderNumber: String,
    category: { type: String, enum: supportCategories },
    message: { type: String, required: true },
    status: { type: String, enum: ticketStatuses, default: 'open' },
    acknowledgeBy: Date,
    acknowledgedAt: Date,
    dueAt: Date,
    resolvedAt: Date,
    replies: [
      {
        _id: false,
        from: { type: String, enum: ['customer', 'support'] },
        message: String,
        at: Date,
      },
    ],
    anonymizedAt: Date,
  },
  { timestamps: true },
);

export const SupportRequest = mongoose.model('SupportRequest', schema);
