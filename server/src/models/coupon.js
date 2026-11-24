import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    _id: String,
    percent: Number,
    amountPaise: Number,
    minimumPaise: { type: Number, required: true },
    startsAt: Date,
    endsAt: Date,
    totalLimit: Number,
    perCustomerLimit: Number,
    active: { type: Boolean, default: true },
    redeemedCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const Coupon = mongoose.model('Coupon', couponSchema);

const redemptionSchema = new mongoose.Schema({
  coupon: { type: String, required: true },
  customerKey: { type: String, required: true },
  accountKey: String,
  orderNumber: { type: String, required: true, unique: true },
  at: { type: Date, default: Date.now },
});
redemptionSchema.index({ coupon: 1, customerKey: 1 });
redemptionSchema.index({ coupon: 1, accountKey: 1 }, { sparse: true });
export const CouponRedemption = mongoose.model('CouponRedemption', redemptionSchema);
