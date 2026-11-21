import type { DiecastCategory, Product } from '../../catalog/product';

export type GarageZone = DiecastCategory | 'rc';

export function garageZoneFor(product: Product): GarageZone {
  return product.productType === 'rc' ? 'rc' : product.category;
}

