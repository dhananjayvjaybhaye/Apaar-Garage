import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Category, Product, ProductPage, ProductType, RcProduct } from './product';

export interface CatalogQuery {
  category?: Category;
  productType?: ProductType;
  skillLevel?: RcProduct['skillLevel'];
  age?: number;
  batteryIncluded?: boolean;
  controlType?: RcProduct['controlType'];
  terrain?: RcProduct['terrain'];
  brand?: string;
  scale?: string;
  q?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: number;
  limit?: number;
  facets?: boolean;
  inStock?: boolean;
  slugs?: string;
  featured?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  getProduct(slug: string) {
    return this.http.get<Product>('/products/' + encodeURIComponent(slug));
  }

  getProducts(query: CatalogQuery) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.http.get<ProductPage>('/products', { params });
  }
}
