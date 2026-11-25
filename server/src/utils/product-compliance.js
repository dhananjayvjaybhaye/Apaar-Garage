import { toPaise } from './commerce.js';
import { certificationAge } from '../config/business.js';

export const hsnPattern = /^(?:\d{4}|\d{6}|\d{8})$/;
export const skuPattern = /^[A-Z0-9][A-Z0-9._-]{0,149}$/;
export const validRupeeAmount = (value) =>
  value >= 0 && Number.isSafeInteger(toPaise(value)) && Number(value.toFixed(2)) === value;
export const validGstRate = (value) =>
  value >= 0 && value <= 100 && Number(value.toFixed(2)) === value;

export const publicationFields = [
  'mrp',
  'gstRatePercent',
  'hsnCode',
  'sku',
  'countryOfOrigin',
  'netQuantity',
  'ageGradeMin',
];

export function publicationIssues(product) {
  const issues = [];
  const add = (field, message) => issues.push({ field, message });
  if (product.mrp != null && product.mrp < product.price)
    add('mrp', 'MRP must be at least the selling price.');
  if (product.status !== 'published') return issues;
  for (const field of publicationFields) {
    if (product[field] == null || product[field] === '') add(field, 'Required to publish.');
  }
  if (
    !(product.manufacturerName && product.manufacturerAddress) &&
    !(product.importerName && product.importerAddress)
  ) {
    add('manufacturerOrImporter', 'Provide a manufacturer or importer name and address.');
  }
  if (product.category !== 'rc-accessory' && product.ageGradeMin < certificationAge) {
    if (product.bisCertified !== true)
      add('bisCertified', 'BIS certification is required for toys graded under 14.');
    if (!product.bisLicenceNumber) add('bisLicenceNumber', 'Provide the BIS licence number.');
  }
  return issues;
}

export function publicProductFilter(production = process.env.NODE_ENV === 'production') {
  return { status: 'published', ...(production && { placeholder: { $ne: true } }) };
}
