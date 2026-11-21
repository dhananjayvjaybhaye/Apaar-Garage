import { Reveal } from '../reveal';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ShopLoading, ShopState } from '../ui/shop-state';
import type { ProductPage } from '../catalog/product';
import { ProductCard } from '../catalog/product-card';
import { WishlistStore } from './wishlist-store';

@Component({
  selector: 'app-wishlist-page',
  imports: [Reveal, ProductCard, ShopLoading, ShopState],
  template: `
    <main class="container wishlist">
      <h1>Wishlist</h1><h2 class="visually-hidden">Saved models</h2>
      @if (store.busy() || products.isLoading()) { <app-shop-loading label="Loading wishlist…" [cards]="true" /> }
      @else if (store.loadError() || products.error()) {
        <app-shop-state title="Wishlist unavailable" message="We couldn’t load your saved models." [retryable]="true" (retry)="retry()" />
      }
      @else if (items().length) { <div class="shopping-grid">@for (product of items(); track product.slug) { <app-product-card [product]="product" [tiltDegrees]="4" [appReveal]="$index" [gentleReveal]="true" /> }</div> }
      @else { <app-shop-state title="Your wishlist is empty" message="Tap the heart on a model to save it for another look." link="/catalog" /> }
    </main>
  `,
  styles: '.wishlist { padding-block:2rem 5rem; } .wishlist h1 { margin:0 0 1rem; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WishlistPage {
  protected readonly store = inject(WishlistStore);
  protected readonly products = httpResource<ProductPage>(() => {
    const slugs = this.store.slugs();
    return slugs.length ? { url: '/products', params: { slugs: slugs.join(','), limit: 100 } } : undefined;
  });
  protected retry() { if (this.store.loadError()) this.store.retry(); else this.products.reload(); }
  protected readonly items = computed(() => this.products.hasValue() ? this.products.value().items : []);
}
