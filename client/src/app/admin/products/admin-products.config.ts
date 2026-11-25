import {
  categoryLabels,
  controlTypes,
  diecastCategories,
  rcCategories,
  skillLevels,
  terrains,
} from '../../catalog/product';

export const productApi = '/api/admin/products';
export const adminProductPath = '/admin/products';
export const imageMaxBytes = 5 * 1024 ** 2;
export const modelWarningBytes = imageMaxBytes;
export const modelMaxBytes = 10 * 1024 ** 2;
export const checklistDelayMs = 400;

export const productStatusOptions = ['draft', 'published', 'hidden', 'archived'] as const;
export type ProductStatus = (typeof productStatusOptions)[number];
export const typeOptions = [
  { value: 'diecast', label: 'Diecast' },
  { value: 'rc', label: 'RC' },
];
export const categoriesFor = (type: string) =>
  (type === 'rc' ? rcCategories : diecastCategories).map((value) => ({
    value,
    label: categoryLabels[value],
  }));
export const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'price-asc', label: 'Price low to high' },
  { value: 'price-desc', label: 'Price high to low' },
  { value: 'stock-asc', label: 'Lowest stock' },
];
export const stockOptions = [
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Sold out' },
];
export const complianceOptions = [
  { value: 'complete', label: 'Complete' },
  { value: 'incomplete', label: 'Incomplete' },
];

export interface Field {
  key: string;
  label: string;
  kind?: 'number' | 'money' | 'textarea' | 'select' | 'boolean';
  options?: readonly { value: string; label: string }[];
  required?: boolean | 'diecast' | 'rc';
  hint?: string;
  unit?: string;
  inline?: boolean;
  type?: 'url';
  autocomplete?: string;
}
export interface Group {
  title: string;
  fields: Field[];
}

const text = (key: string, label: string, required = false): Field => ({ key, label, required });
const number = (key: string, label: string, kind: Field['kind'] = 'number'): Field => ({
  key,
  label,
  kind,
});
const publish = (field: Field): Field => ({ ...field, hint: 'Required to publish.' });
const measured = (key: string, label: string, unit: string, kind: Field['kind'] = 'number'): Field => ({ ...number(key, label, kind), unit });
const bool = (key: string, label: string, required = false): Field => ({
  key,
  label,
  kind: 'boolean',
  required,
});
const area = (key: string, label: string, required = false): Field => ({
  key,
  label,
  kind: 'textarea',
  required,
});
const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

export const generalFields: Group[] = [
  {
    title: 'Product details',
    fields: [
      text('name', 'Product name', true),
      text('slug', 'URL slug', true),
      text('brand', 'Brand', true),
      {
        key: 'productType',
        label: 'Product type',
        kind: 'select',
        options: typeOptions,
        required: true,
      },
      { key: 'category', label: 'Category', kind: 'select', required: true },
      { ...text('scale', 'Scale'), required: 'diecast' },
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: options(productStatusOptions),
        required: true,
      },
      bool('featured', 'Featured'),
      bool('placeholder', 'Placeholder listing'),
      area('description', 'Description', true),
      measured('dimensionsMm.length', 'Length', 'mm'),
      measured('dimensionsMm.width', 'Width', 'mm'),
      measured('dimensionsMm.height', 'Height', 'mm'),
    ],
  },
  {
    title: 'Pricing and inventory',
    fields: [
      { ...measured('price', 'Selling price', '₹', 'money'), required: true },
      publish(measured('mrp', 'MRP (including taxes)', '₹', 'money')),
      measured('costPrice', 'Cost price', '₹', 'money'),
      { ...number('stock', 'Opening stock'), required: true },
      publish(text('sku', 'SKU')),
      text('barcode', 'Barcode'),
      measured('weightGrams', 'Weight', 'g'),
      number('lowStockThreshold', 'Low-stock threshold'),
      measured('returnWindowDays', 'Return window', 'days'),
      { ...measured('warrantyDays', 'Warranty', 'days'), required: 'rc' },
    ],
  },
  {
    title: 'Compliance and shipping',
    fields: [
      publish(measured('gstRatePercent', 'GST rate', '%', 'money')),
      publish(text('hsnCode', 'HSN code')),
      publish(text('countryOfOrigin', 'Country of origin')),
      text('genericName', 'Generic product name'),
      publish(text('netQuantity', 'Net quantity')),
      publish(measured('ageGradeMin', 'Minimum age grade', 'years')),
      text('manufacturerName', 'Manufacturer name'),
      { ...area('manufacturerAddress', 'Manufacturer address'), inline: true },
      text('importerName', 'Importer name'),
      { ...area('importerAddress', 'Importer address'), inline: true },
      bool('bisCertified', 'BIS certified'),
      text('bisLicenceNumber', 'BIS licence number'),
      { ...text('isiMarkImageUrl', 'ISI packaging image URL'), type: 'url' },
      bool('hasLithiumBattery', 'Contains lithium battery'),
      measured('batteryWh', 'Battery energy', 'Wh', 'money'),
      area('shippingNote', 'Battery / shipping notes'),
    ],
  },
];

export const metadataFields: Group = {
  title: 'Tags and search previews',
  fields: [
    area('tags', 'Tags (one per line)'),
    text('seoTitle', 'SEO title'),
    area('seoDescription', 'SEO description'),
  ],
};

export const rcFields: Group = {
  title: 'RC details',
  fields: [
    text('batteryType', 'Battery type'),
    bool('batteryIncluded', 'Battery included', true),
    measured('runTime', 'Run time', 'minutes', 'money'),
    measured('chargeTime', 'Charge time', 'minutes', 'money'),
    measured('topSpeed', 'Top speed', 'km/h', 'money'),
    measured('controlRange', 'Control range', 'metres', 'money'),
    { key: 'controlType', label: 'Control type', kind: 'select', options: options(controlTypes) },
    { key: 'terrain', label: 'Terrain', kind: 'select', options: options(terrains) },
    {
      key: 'skillLevel',
      label: 'Skill level',
      kind: 'select',
      options: options(skillLevels),
      required: true,
    },
    { ...measured('recommendedAge', 'Recommended age', 'years'), required: true },
    bool('readyToRun', 'Ready to run', true),
    area('boxContents', 'What’s in the box (one item per line)', true),
  ],
};
