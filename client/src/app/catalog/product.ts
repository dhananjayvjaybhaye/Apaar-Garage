export const diecastCategories = ['car', 'truck', 'bike'] as const;
export const rcCategories = ['rc-car', 'rc-truck', 'rc-plane', 'rc-boat', 'rc-drone', 'rc-bike', 'rc-accessory'] as const;
export type ProductType = 'diecast' | 'rc';
export type DiecastCategory = typeof diecastCategories[number];
export type RcCategory = typeof rcCategories[number];
export type Category = DiecastCategory | RcCategory;
export const categoryLabels: Record<Category, string> = {
  car: 'Cars', truck: 'Trucks', bike: 'Bikes',
  'rc-car': 'RC Cars', 'rc-truck': 'RC Trucks', 'rc-plane': 'RC Planes', 'rc-boat': 'RC Boats',
  'rc-drone': 'RC Drones', 'rc-bike': 'RC Bikes', 'rc-accessory': 'RC Accessories',
};
export const controlTypes = ['2.4GHz', 'Wi-Fi', 'app'] as const;
export const terrains = ['indoor', 'outdoor', 'all-terrain'] as const;
export const skillLevels = ['beginner', 'intermediate', 'expert'] as const;

export function categoryType(category: Category): ProductType {
  return category.startsWith('rc-') ? 'rc' : 'diecast';
}

export interface RatingSummary {
  ratingAverage: number;
  ratingCount: number;
}

interface BaseProduct {
  name: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  slug: string;
  brand: string;
  price: number;
  stock: number;
  images: string[];
  glbUrl?: string;
  description: string;
  featured: boolean;
  dimensionsMm?: { length?: number; width?: number; height?: number };
  addedAt?: string;
}

export interface RcProduct extends BaseProduct {
  productType: 'rc';
  category: RcCategory;
  scale?: string;
  batteryType?: string;
  batteryIncluded: boolean;
  runTime?: number;
  chargeTime?: number;
  topSpeed?: number;
  controlRange?: number;
  controlType?: typeof controlTypes[number];
  terrain?: typeof terrains[number];
  skillLevel: typeof skillLevels[number];
  recommendedAge: number;
  readyToRun: boolean;
  warrantyDays: number;
  boxContents: string[];
  placeholder?: boolean;
}

export type Product = (BaseProduct & { productType: 'diecast'; category: DiecastCategory; scale: string }) | RcProduct;

export interface ProductPage {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  facets?: { brands: string[]; scales: string[] };
}
