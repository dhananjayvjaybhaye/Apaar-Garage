import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  account: { type: mongoose.Schema.Types.ObjectId, index: true },
  subscribedAt: { type: Date, required: true },
  consent: { _id: false, at: Date, textVersion: String, source: String },
  unsubscribedAt: Date,
  tokenNonce: { type: String, select: false },
  tokenHash: { type: String, select: false },
});
schema.index({ tokenHash: 1 }, { unique: true, sparse: true });
export const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', schema);
