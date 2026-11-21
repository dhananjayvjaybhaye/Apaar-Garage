import { httpResource } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, interval, merge } from 'rxjs';
import type { ProductPage } from '../catalog/product';
import { getSlugs, storeSlugs } from './browser-storage';

const key = 'apaar-stock-watch';

@Injectable({ providedIn: 'root' })
export class StockWatch {
  private readonly watched = signal(getSlugs(key).slice(0, 25));
  readonly slugs = this.watched.asReadonly();
  private readonly products = httpResource<ProductPage>(() => {
    const slugs = this.slugs();
    return slugs.length ? {
      url: '/products', params: { slugs: slugs.join(','), inStock: true, limit: 25 },
    } : undefined;
  });
  readonly restocked = computed(() => {
    const watched = this.slugs();
    return this.products.hasValue() ? this.products.value().items.filter((product) => watched.includes(product.slug)) : [];
  });

  constructor() {
    const navigation = inject(Router).events.pipe(filter((event) => event instanceof NavigationEnd));
    merge(navigation, interval(60_000)).pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.slugs().length && !document.hidden) this.products.reload();
    });
  }

  toggle(slug: string) {
    const slugs = this.slugs();
    if (slugs.includes(slug)) this.dismiss(slug);
    else this.update([slug, ...slugs].slice(0, 25));
  }

  dismiss(slug: string) {
    this.update(this.slugs().filter((entry) => entry !== slug));
  }

  private update(slugs: string[]) {
    this.watched.set(slugs);
    storeSlugs(key, slugs);
  }
}
