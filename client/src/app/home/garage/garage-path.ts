import type { DiecastCategory, Product } from '../../catalog/product';

export type GarageZone = DiecastCategory | 'rc';
export type RcBenchStatus = 'loading' | 'ready' | 'unavailable';

export function garageZoneFor(product: Product): GarageZone {
  // The catalog also contains older records whose stored productType can be out of date.
  const { category } = product;
  return category === 'car' || category === 'truck' || category === 'bike' ? category : 'rc';
}
