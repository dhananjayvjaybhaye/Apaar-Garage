import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, input, linkedSignal } from '@angular/core';
import { ProductCard } from '../catalog/product-card';
import type { Product, ProductPage } from '../catalog/product';
import { getSlugs, storeSlugs } from '../shop/browser-storage';

const historyKey = 'apaar-recently-viewed';

@Component({
  selector: 'app-product-recommendations',
  imports: [ProductCard],
  template: `
    @if (recent.hasValue() && recent.value().length) {
      <section aria-label="Recently viewed">
        <h2>Recently viewed</h2>
        <div class="shopping-grid">
          @for (item of recent.value(); track item.slug) { <app-product-card [product]="item" /> }
        </div>
      </section>
    }
    @if (related.hasValue() && related.value().length) {
      <section aria-label="You may also like">
        <h2>You may also like</h2>
        <div class="shopping-grid">
          @for (item of related.value(); track item.slug) { <app-product-card [product]="item" /> }
        </div>
      </section>
    }
  `,
  styles: 'section { margin-top:2.5rem; } h2 { margin-bottom:1rem; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductRecommendations {
  readonly product = input.required<Product>();
  private readonly recentSlugs = linkedSignal({
    source: () => this.product().slug,
    computation: (slug) => getSlugs(historyKey).filter((entry) => entry !== slug).slice(0, 8),
  });

  protected readonly recent = httpResource(() => this.recentSlugs().length ? {
    url: '/products', params: { slugs: this.recentSlugs().join(','), limit: 8 },
  } : undefined, {
    parse: (data) => {
      const products = new Map((data as ProductPage).items.map((item) => [item.slug, item]));
      return this.recentSlugs().flatMap((slug) => products.get(slug) ?? []);
    },
  });

  protected readonly related = httpResource(() => ({
    url: '/products', params: { category: this.product().category, sort: 'popular', limit: 5 },
  }), {
    parse: (data) => (data as ProductPage).items.filter((item) => item.slug !== this.product().slug).slice(0, 4),
  });

  constructor() {
    effect(() => storeSlugs(historyKey, [this.product().slug, ...this.recentSlugs()].slice(0, 8)));
  }
}
