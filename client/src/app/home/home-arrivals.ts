import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ProductCard } from '../catalog/product-card';
import type { ProductPage } from '../catalog/product';
import { Reveal } from '../reveal';
import { ShopState } from '../ui/shop-state';
import { arrivalLimit } from './home-content.config';

@Component({
  selector: 'app-home-arrivals',
  imports: [RouterLink, ProductCard, Reveal, ShopState],
  template: `
    <section class="container arrivals" aria-labelledby="arrivals-title">
      <div class="heading" appReveal>
        <h2 id="arrivals-title">New Arrivals</h2>
        <a routerLink="/catalog" [queryParams]="{ sort: 'newest' }">Shop new arrivals</a>
      </div>
      @if (!near() || products.isLoading()) {
        <p class="visually-hidden" role="status">Loading new arrivals…</p>
        <div class="row" aria-hidden="true">
          @for (placeholder of [1, 2, 3, 4]; track placeholder) {
            <div class="skeleton"></div>
          }
        </div>
      } @else if (products.error()) {
        <app-shop-state
          title="New arrivals are unavailable"
          message="Try again in a moment."
          [compact]="true"
          [retryable]="true"
          (retry)="products.reload()"
        />
      } @else if (products.hasValue() && products.value().items.length) {
        <div class="row" role="region" aria-label="New arrivals products" tabindex="0">
          @for (item of products.value().items; track item.slug; let index = $index) {
            <app-product-card [product]="item" [appReveal]="index" addLabel="Add to Cart" />
          }
        </div>
      } @else {
        <p>No new arrivals yet. Check back for the next drop.</p>
      }
    </section>
  `,
  styleUrl: './home-arrivals.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeArrivals {
  protected readonly near = signal(false);
  protected readonly products = httpResource<ProductPage>(() =>
    this.near()
      ? {
          url: '/products',
          params: { sort: 'newest', limit: arrivalLimit },
        }
      : undefined,
  );
}
