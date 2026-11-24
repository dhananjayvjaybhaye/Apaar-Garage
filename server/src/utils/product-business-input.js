import { z } from 'zod';
import { maximumAgeGrade, productStatuses } from '../config/business.js';
import { hsnPattern, skuPattern, validGstRate, validRupeeAmount } from './product-compliance.js';

const text = z.string().trim().min(1).optional();
const nonnegative = z.number().nonnegative().optional();
const rupees = z
  .number()
  .refine(validRupeeAmount, 'Enter a nonnegative amount with up to two decimals.')
  .optional();
const whole = z.int().nonnegative().optional();

export const productBusinessInput = {
  mrp: rupees,
  gstRatePercent: z
    .number()
    .refine(validGstRate, 'Enter a GST percentage between 0 and 100 with up to two decimals.')
    .optional(),
  hsnCode: z.string().trim().regex(hsnPattern, 'Enter a 4, 6 or 8 digit HSN code.').optional(),
  sku: z.string().trim().toUpperCase().regex(skuPattern, 'Enter a valid SKU.').optional(),
  barcode: text,
  weightGrams: whole,
  costPrice: rupees,
  countryOfOrigin: text,
  manufacturerName: text,
  manufacturerAddress: text,
  importerName: text,
  importerAddress: text,
  genericName: text,
  netQuantity: text,
  ageGradeMin: z.int().min(0).max(maximumAgeGrade).optional(),
  bisCertified: z.boolean().optional(),
  bisLicenceNumber: text,
  isiMarkImageUrl: z
    .union([z.url({ protocol: /^https?$/ }), z.string().regex(/^\/images\/[\w.%/-]+$/)])
    .optional(),
  hasLithiumBattery: z.boolean().optional(),
  batteryWh: nonnegative,
  shippingNote: text,
  returnWindowDays: whole,
  lowStockThreshold: whole,
  status: z.enum(productStatuses).optional(),
};
