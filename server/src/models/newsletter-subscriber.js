// Uses the normalized email as the unique newsletter subscription key.
import mongoose from 'mongoose';

export const NewsletterSubscriber = mongoose.model(
  'NewsletterSubscriber',
  new mongoose.Schema({
    _id: { type: String, required: true },
    subscribedAt: { type: Date, required: true },
  }),
);
