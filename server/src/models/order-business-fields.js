import mongoose from 'mongoose';
import { confirmationStatuses, stockConditions, undeliveredReasons } from '../config/business.js';

const actor = { type: mongoose.Schema.Types.ObjectId, ref: 'User' };
const embedded = (fields) => new mongoose.Schema(fields, { _id: false });
export const nonnegativePaise = { type: Number, min: 0, validate: Number.isSafeInteger };

export const itemBusinessFields = {
  sku: String,
  hsn: String,
  gstRatePercent: Number,
  mrpPaise: nonnegativePaise,
  taxablePaise: nonnegativePaise,
  taxPaise: nonnegativePaise,
  discountPaise: nonnegativePaise,
  returnWindowDays: Number,
};

export const orderBusinessFields = {
  risk: embedded({ phoneKey: String, addressKey: String, flags: [String] }),
  needsConfirmation: { type: Boolean, default: false },
  policyAcceptance: embedded({ version: String, at: Date }),
  anonymizedAt: Date,
  purgeAfter: Date,
  seller: embedded({
    name: String,
    tradeName: String,
    invoicePrefix: String,
    state: String,
    address: String,
    gstin: String,
    gstRegistered: Boolean,
  }),
  taxBreakup: {
    type: [
      embedded({
        gstRatePercent: Number,
        taxablePaise: nonnegativePaise,
        cgstPaise: nonnegativePaise,
        sgstPaise: nonnegativePaise,
        igstPaise: nonnegativePaise,
      }),
    ],
    default: undefined,
  },
  invoiceNumber: { type: String, unique: true, sparse: true },
  invoiceType: { type: String, enum: ['tax_invoice', 'bill_of_supply'] },
  invoiceAt: Date,
  shipment: embedded({
    courier: String,
    awb: String,
    trackingUrl: String,
    shippedAt: Date,
    deliveredAt: Date,
    undeliveredReason: { type: String, enum: undeliveredReasons },
    undeliveredNote: String,
    returnedToSellerAt: Date,
    returnCondition: { type: String, enum: stockConditions },
  }),
  cancellation: embedded({ reasonCode: String, note: String, cancelledBy: actor, at: Date }),
  adminNotes: [embedded({ note: String, by: actor, at: Date })],
  customerConfirmation: {
    type: embedded({ status: { type: String, enum: confirmationStatuses }, at: Date, by: actor }),
    default: () => ({ status: 'pending' }),
  },
  returnVersion: { type: Number, default: 0 },
};
