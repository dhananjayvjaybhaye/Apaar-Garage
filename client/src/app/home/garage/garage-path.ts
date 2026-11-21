import type { DiecastCategory, Product } from '../../catalog/product';

export type GarageZone = DiecastCategory | 'rc';

export function garageZoneFor(product: Product): GarageZone {
  return product.productType === 'rc' ? 'rc' : product.category;
}

export const zones = [
  { category: 'car', name: 'Cars', center: 1 / 8, x: -8.7 },
  { category: 'truck', name: 'Trucks', center: 3 / 8, x: -2.9 },
  { category: 'bike', name: 'Bikes', center: 5 / 8, x: 2.9 },
  { category: 'rc', name: 'RC', center: 7 / 8, x: 8.7 },
] as const satisfies ReadonlyArray<{ category: GarageZone; name: string; center: number; x: number }>;

const stops = [
  { at: 0, x: -6.7, y: 3.5, z: 13.7, lookX: -6.2, lookY: 2.18 },
  ...zones.map((zone) => ({ at: zone.center, x: zone.x, y: 2.9, z: 8.9, lookX: zone.x, lookY: 1.83 })),
  { at: 1, x: 8.55, y: 3.95, z: 15.8, lookX: 7.1, lookY: 2.2 },
];

export function zoneAt(progress: number) {
  return Math.min(zones.length - 1, Math.max(0, Math.floor(progress * zones.length)));
}

export function ease(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export function cameraAt(progress: number) {
  const end = stops.findIndex((stop, index) => index > 0 && progress <= stop.at);
  const next = stops[end < 0 ? stops.length - 1 : end];
  const prior = stops[end < 0 ? stops.length - 2 : end - 1];
  const t = ease((progress - prior.at) / (next.at - prior.at));
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    x: mix(prior.x, next.x), y: mix(prior.y, next.y), z: mix(prior.z, next.z),
    lookX: mix(prior.lookX, next.lookX), lookY: mix(prior.lookY, next.lookY),
  };
}
