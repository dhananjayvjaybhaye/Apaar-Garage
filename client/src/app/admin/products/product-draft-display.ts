import { categoriesFor } from './admin-products.config';
import { draftFields, type AdminProductRecord, type DraftFields } from './admin-product-types';

export function draftMargin({ price, costPrice }: DraftFields) {
  if (!price?.trim() || !costPrice?.trim()) return null;
  const sale = Number(price);
  const cost = Number(costPrice);
  if (!Number.isFinite(sale) || !Number.isFinite(cost)) return null;
  return { amount: sale - cost, percent: sale > 0 ? ((sale - cost) / sale) * 100 : null };
}

export function draftImages(product?: Partial<AdminProductRecord>) {
  return product?.images?.map((url, index) => ({ url, alt: product.imageAlts?.[index] ?? '' }));
}

export function prefillPatch(data: Partial<AdminProductRecord>, previousType: string) {
  const patch = draftFields(data, true);
  const type = patch['productType'];
  if (type && type !== previousType && !patch['category'])
    patch['category'] = categoriesFor(type)[0].value;
  return {
    patch,
    images: draftImages(data),
    filled: new Set([
      ...Object.keys(patch),
      ...(data.images ? ['images'] : []),
      ...(data.glbUrl ? ['glbUrl'] : []),
    ]),
  };
}
