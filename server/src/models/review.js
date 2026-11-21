import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, required: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    comment: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true },
);

schema.index({ product: 1, buyer: 1 }, { unique: true });
schema.index({ product: 1, createdAt: -1, _id: -1 });
export const Review = mongoose.model('Review', schema);
