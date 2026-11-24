import mongoose from 'mongoose';

const schema = new mongoose.Schema({ _id: String, sequence: { type: Number, required: true } });
export const InvoiceCounter = mongoose.model('InvoiceCounter', schema);
