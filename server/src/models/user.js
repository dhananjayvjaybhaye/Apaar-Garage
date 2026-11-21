import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
    },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    wishlist: { type: [String], default: [] },
    savedAddresses: [
      {
        fullName: String,
        phone: String,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        pincode: String,
      },
    ],
    checkoutVersion: { type: Number, default: 0, select: false },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
