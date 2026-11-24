import mongoose from 'mongoose';

const contact = new mongoose.Schema(
  {
    phone: { type: String, match: /^[6-9]\d{9}$/ },
    pincode: { type: String, match: /^[1-9]\d{5}$/ },
    reason: { type: String, required: true },
  },
  { timestamps: true },
);
contact.index({ phone: 1, pincode: 1 }, { unique: true });
export const BlockedContact = mongoose.model('BlockedContact', contact);

// Keys are HMACs, never raw mobile numbers or addresses.
export const CodLock = mongoose.model(
  'CodLock',
  new mongoose.Schema({
    _id: String,
    expiresAt: { type: Date, expires: 0 },
    version: Number,
  }),
);
