// Stores the messages customers send through the support form.
import mongoose from 'mongoose';

export const SupportRequest = mongoose.model(
  'SupportRequest',
  new mongoose.Schema(
    {
      email: { type: String, required: true },
      message: { type: String, required: true },
    },
    { timestamps: true },
  ),
);
