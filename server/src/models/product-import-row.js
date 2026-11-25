import mongoose from 'mongoose';

// The receipt and its product mutation commit in one transaction.
const schema = new mongoose.Schema({
  _id: String,
  attempt: String,
  at: { type: Date, default: Date.now },
});
export const ProductImportRow = mongoose.model('ProductImportRow', schema);
