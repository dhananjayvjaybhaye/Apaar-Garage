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
    adminAccess: { type: String, enum: ['owner', 'staff'] },
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
    adminTotp: {
      type: new mongoose.Schema(
        {
          encrypted: String,
          lastStep: Number,
          recoveryHashes: [String],
        },
        { _id: false },
      ),
      select: false,
    },
    sessionVersion: { type: Number, default: 0, select: false },
    checkoutVersion: { type: Number, default: 0, select: false },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, createdAt: -1, _id: -1 });
export const User = mongoose.model('User', userSchema);
