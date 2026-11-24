import { maximumAgeGrade, productStatuses } from '../config/business.js';
import {
  hsnPattern,
  skuPattern,
  validGstRate,
  validRupeeAmount,
} from '../utils/product-compliance.js';

const label = { type: String, trim: true };
const nonnegative = { type: Number, min: 0 };
const whole = { ...nonnegative, validate: Number.isSafeInteger };

export const productBusinessFields = {
  mrp: { type: Number, validate: validRupeeAmount },
  gstRatePercent: { type: Number, validate: validGstRate },
  hsnCode: { ...label, match: hsnPattern },
  sku: { ...label, uppercase: true, match: skuPattern, unique: true, sparse: true },
  barcode: label,
  weightGrams: whole,
  costPrice: { type: Number, validate: validRupeeAmount, select: false },
  countryOfOrigin: label,
  manufacturerName: label,
  manufacturerAddress: label,
  importerName: label,
  importerAddress: label,
  genericName: label,
  netQuantity: label,
  ageGradeMin: { ...whole, max: maximumAgeGrade },
  bisCertified: Boolean,
  bisLicenceNumber: label,
  isiMarkImageUrl: label,
  hasLithiumBattery: Boolean,
  batteryWh: nonnegative,
  shippingNote: label,
  returnWindowDays: whole,
  lowStockThreshold: whole,
  status: { type: String, enum: productStatuses, default: 'draft' },
};
