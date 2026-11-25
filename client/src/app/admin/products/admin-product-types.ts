import {
  generalFields,
  metadataFields,
  rcFields,
  type ProductStatus,
} from './admin-products.config';

export interface AdminProductIssue {
  field: string;
  message: string;
  slug?: string;
}
export interface AdminImage {
  url: string;
  alt: string;
}
export interface AdminProductSummary {
  slug: string;
  name: string;
  sku?: string;
  image?: string;
  productType: string;
  category: string;
  brand: string;
  stock: number;
  price: number;
  status: ProductStatus;
  placeholder: boolean;
  issues: AdminProductIssue[];
}
export interface AdminProductPage {
  items: AdminProductSummary[];
  page: number;
  pages: number;
  total: number;
}
export interface AdminProductRecord extends Record<string, unknown> {
  slug: string;
  status: ProductStatus;
  stock: number;
  images: string[];
  imageAlts?: string[];
  glbUrl?: string;
  dimensionsMm?: Record<string, number>;
  boxContents?: string[];
}

export type DraftFields = Record<string, string>;
const fields = [
  ...generalFields.flatMap((group) => group.fields),
  ...rcFields.fields,
  ...metadataFields.fields,
];

export function draftFields(
  product?: Partial<AdminProductRecord>,
  filledOnly = false,
): DraftFields {
  const defaults = {
    productType: 'diecast',
    category: 'car',
    status: 'draft',
    stock: '0',
    batteryIncluded: 'false',
    readyToRun: 'false',
  };
  if (!product) return defaults;
  return Object.fromEntries(
    fields.flatMap(({ key }) => {
      const value = key.startsWith('dimensionsMm.')
        ? product.dimensionsMm?.[key.split('.')[1]]
        : product[key];
      if (filledOnly && value == null) return [];
      return [
        [
          key,
          Array.isArray(value)
            ? value.join('\n')
            : value == null
              ? key === 'status'
                ? 'draft'
                : ''
              : String(value),
        ],
      ];
    }),
  );
}

export function productPayload(
  draft: DraftFields,
  images: AdminImage[],
  model: string,
  editing: boolean,
) {
  const payload: Record<string, unknown> = {
    images: images.map(({ url }) => url),
    imageAlts: images.map(({ alt }) => alt),
    glbUrl: model.trim() || (editing ? null : undefined),
  };
  const dimensions: Record<string, number> = {};
  const isRc = draft['productType'] === 'rc';
  for (const field of fields) {
    const { key, kind } = field;
    if (editing && ['slug', 'stock'].includes(key)) continue;
    if (!isRc && rcFields.fields.includes(field)) {
      if (editing) payload[key] = null;
      continue;
    }
    const value = draft[key]?.trim() ?? '';
    if (key.startsWith('dimensionsMm.')) {
      if (value) dimensions[key.split('.')[1]] = Number(value);
      continue;
    }
    if (!value) {
      payload[key] = editing ? null : undefined;
    } else if (key === 'boxContents' || key === 'tags') {
      payload[key] = value
        .split('\n')
        .map((part) => part.trim())
        .filter(Boolean);
    } else if (kind === 'number' || kind === 'money') {
      payload[key] = Number(value);
    } else if (kind === 'boolean') {
      payload[key] = value === 'true';
    } else {
      payload[key] = value;
    }
  }
  payload['dimensionsMm'] = Object.keys(dimensions).length
    ? dimensions
    : editing
      ? null
      : undefined;
  return payload;
}

export function readIssues(error: unknown): AdminProductIssue[] {
  if (error && typeof error === 'object' && 'error' in error) {
    const body = error.error;
    if (body && typeof body === 'object' && 'details' in body && Array.isArray(body.details))
      return body.details as AdminProductIssue[];
  }
  return [];
}

export function productLabel(field: string) {
  return (
    fields.find(({ key }) => key === field)?.label ??
    (
      {
        images: 'Product images',
        imageAlts: 'Image alt text',
        manufacturerOrImporter: 'Manufacturer or importer',
        glbUrl: 'GLB model',
      } as Record<string, string>
    )[field] ??
    field
  );
}
