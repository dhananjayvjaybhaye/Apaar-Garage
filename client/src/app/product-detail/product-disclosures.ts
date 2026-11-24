import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Product } from '../catalog/product';
import { StoreInformation } from '../store-footer/store-info';

@Component({
  selector: 'app-product-disclosures',
  templateUrl: './product-disclosures.html',
  styles: `
    :host {
      display: block;
    }
    h2 {
      margin: 0 0 0.8rem;
      font-size: 1.2rem;
    }
    dl {
      display: grid;
      gap: 0.6rem;
      margin: 0;
    }
    dt {
      font-size: 0.9rem;
      color: var(--muted);
    }
    img {
      display: block;
      object-fit: contain;
      object-position: left center;
    }
    dd {
      margin: 0.1rem 0 0;
      overflow-wrap: anywhere;
      white-space: pre-line;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDisclosures {
  readonly product = input.required<Product>();
  private readonly store = inject(StoreInformation);
  protected readonly returnDays = computed(
    () => this.product().returnWindowDays ?? this.store.data()?.defaultReturnWindowDays,
  );
}
