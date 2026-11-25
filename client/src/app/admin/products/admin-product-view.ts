import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiMessage } from '../../api-message';
import type { AdminProductSummary } from './admin-product-types';
import { productApi } from './admin-products.config';

type ProductView = Pick<AdminProductSummary, 'name' | 'sku' | 'brand' | 'category' | 'status' | 'stock' | 'price'> & {
  images: string[];
  description: string;
};

@Component({
  imports: [CurrencyPipe, TitleCasePipe, RouterLink],
  template: `
    <main>
      <header class="admin-header">
        <h1>{{ product.hasValue() ? product.value().name : 'Product details' }}</h1>
        <a class="secondary-button" routerLink="/admin/products">Back to products</a>
      </header>
      @if (product.hasValue()) {
        @let item = product.value();
        <section class="admin-box">
          @if (item.images[0]; as cover) { <img [src]="cover" width="160" alt="" /> }
          <dl>
            <dt>SKU</dt><dd>{{ item.sku || '—' }}</dd>
            <dt>Brand</dt><dd>{{ item.brand }}</dd>
            <dt>Category</dt><dd>{{ item.category }}</dd>
            <dt>Status</dt><dd>{{ item.status | titlecase }}</dd>
            <dt>Price</dt><dd>{{ item.price | currency: 'INR' }}</dd>
            <dt>Stock</dt><dd>{{ item.stock }}</dd>
          </dl>
          <p class="admin-paragraph">{{ item.description }}</p>
        </section>
      } @else if (product.isLoading()) { <p role="status">Loading product…</p> }
      @else {
        <p class="error-text" role="alert">{{ error() }}</p>
        <button type="button" class="secondary-button" (click)="product.reload()">Retry</button>
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductView {
  private readonly slug = toSignal(inject(ActivatedRoute).paramMap.pipe(map((value) => value.get('slug'))));
  protected readonly product = httpResource<ProductView>(() => {
    const slug = this.slug();
    return slug ? productApi + '/' + encodeURIComponent(slug) : undefined;
  });

  protected error() { return apiMessage(this.product.error(), 'Could not load this product.'); }
}
