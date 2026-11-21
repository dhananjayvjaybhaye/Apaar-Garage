import type { Product } from '../catalog/product';
export type SeoProduct = Pick<
  Product,
  | 'slug'
  | 'name'
  | 'brand'
  | 'description'
  | 'category'
  | 'price'
  | 'stock'
  | 'images'
  | 'placeholder'
>;
export interface PageMetadata {
  title: string;
  description: string;
  image: string;
  canonical: string;
  type: string;
  indexable: boolean;
  graph: readonly object[];
}
export function siteOrigin(value: string): string;
export function pageMetadata(address: string, origin: string, product?: SeoProduct): PageMetadata;
export function metadataTags(
  info: PageMetadata,
): [kind: 'name' | 'property', key: string, content: string][];
export function structuredData(nodes: readonly object[]): string;
