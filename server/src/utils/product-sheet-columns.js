import { productFields } from './product-input.js';

const core = [
  'sku',
  'slug',
  'name',
  'productType',
  'category',
  'brand',
  'scale',
  'description',
  'price',
  'mrp',
  'costPrice',
  'stock',
  'status',
];
const available = new Set(productFields.options.flatMap((variant) => Object.keys(variant.shape)));
export const dimensionKeys = ['length', 'width', 'height'];
export const lists = new Set(['images', 'imageAlts', 'imageFiles', 'tags', 'boxContents']);
const readOnly = ['ratingCount', 'ratingTotal', 'sales'];
export const columns = [
  ...core,
  ...[...available].filter((field) => !core.includes(field) && field !== 'dimensionsMm'),
  ...dimensionKeys.map((key) => 'dimensionsMm.' + key),
  'imageFiles',
  ...readOnly,
];
export const writableColumns = columns.filter((key) => !readOnly.includes(key));
export const numericFields = new Set([
  'price',
  'mrp',
  'costPrice',
  'stock',
  'gstRatePercent',
  'weightGrams',
  'ageGradeMin',
  'batteryWh',
  'returnWindowDays',
  'lowStockThreshold',
  'warrantyDays',
  'runTime',
  'chargeTime',
  'topSpeed',
  'controlRange',
  'recommendedAge',
  ...dimensionKeys.map((key) => 'dimensionsMm.' + key),
]);
export const booleanFields = new Set([
  'featured',
  'placeholder',
  'bisCertified',
  'hasLithiumBattery',
  'batteryIncluded',
  'readyToRun',
]);

const notes = {
  slug: 'Lowercase words separated by hyphens. Existing slugs are fixed.',
  sku: 'Required; unique. Matches existing products in create and update mode.',
  productType: 'diecast or rc',
  category:
    'car, truck, bike, rc-car, rc-truck, rc-plane, rc-boat, rc-drone, rc-bike, rc-accessory',
  scale: 'Ratio such as 1:64',
  price: 'INR, including tax, up to 2 decimal places',
  mrp: 'INR, at least the selling price',
  costPrice: 'INR; private; excluded from export by default',
  stock:
    'Target stock, whole units. Blank preserves existing stock or opens a new listing at zero.',
  status: 'Exported listing status. Import writes changed products as draft.',
  gstRatePercent: 'Percent, 0–100',
  weightGrams: 'Grams',
  batteryWh: 'Watt-hours',
  runTime: 'Minutes',
  chargeTime: 'Minutes',
  topSpeed: 'km/h',
  controlRange: 'Metres',
  controlType: '2.4GHz, Wi-Fi or app',
  terrain: 'indoor, outdoor or all-terrain',
  skillLevel: 'beginner, intermediate or expert',
  recommendedAge: 'Years',
  ageGradeMin: 'Years',
  hsnCode: '4, 6 or 8 digits. Store as text.',
  barcode: 'Store as text to preserve leading zeros.',
  images: 'JSON list of HTTP(S) URLs or paths beginning with /',
  imageFiles: 'JSON list of filenames inside the optional image ZIP',
  imageAlts: 'JSON list in image order. Use an empty string where alt text is unspecified.',
};

export function columnNote(key) {
  if (notes[key]) return notes[key];
  if (readOnly.includes(key)) return 'Read-only; ignored on import';
  if (key.startsWith('dimensionsMm.')) return 'Millimetres';
  if (key.endsWith('Days') || key === 'lowStockThreshold')
    return key.endsWith('Days') ? 'Whole days' : 'Whole units';
  if (lists.has(key)) return 'JSON list of text values';
  if (booleanFields.has(key)) return 'TRUE or FALSE';
  return 'Text';
}

export function flattenProduct(product) {
  const { dimensionsMm, ...fields } = product;
  return {
    ...fields,
    ...dimensionKeys
      .map((key) => ['dimensionsMm.' + key, dimensionsMm?.[key]])
      .reduce(
        (entries, [key, value]) => (value === undefined ? entries : { ...entries, [key]: value }),
        {},
      ),
  };
}
