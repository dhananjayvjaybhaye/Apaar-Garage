import { AmbientVisible } from '../motion/ambient-visible';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, distinctUntilChanged, filter, map, of, startWith, switchMap, timer } from 'rxjs';
import { CatalogApi } from '../catalog/catalog-api';
import type { Product } from '../catalog/product';

type SearchState = { loading: boolean; items: Product[]; error?: boolean };
const empty: SearchState = { loading: false, items: [] };

@Component({
  selector: 'app-shop-search',
  imports: [AmbientVisible, CurrencyPipe, RouterLink],
  templateUrl: './shop-search.html',
  styleUrl: './shop-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopSearch {
  private readonly api = inject(CatalogApi);
  private readonly router = inject(Router);
  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly visible = computed(() => this.open() && this.text().trim().length >= 2);
  private readonly attempt = signal(0);
  protected readonly results = toSignal(
    combineLatest([
      toObservable(this.text).pipe(map((text) => text.trim()), distinctUntilChanged()),
      toObservable(this.attempt),
    ]).pipe(
      switchMap(([q]) => q.length < 2 ? of(empty) : timer(230).pipe(
        switchMap(() => this.api.getProducts({ q, limit: 5 })),
        map(({ items }): SearchState => ({ items, loading: false })),
        catchError(() => of<SearchState>({ ...empty, error: true })),
        startWith<SearchState>({ ...empty, loading: true }),
      )),
    ), { initialValue: empty },
  );

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationStart), takeUntilDestroyed())
      .subscribe(() => this.open.set(false));
  }

  protected retry() { this.attempt.update((value) => value + 1); }

  protected update(value: string) {
    this.text.set(value);
    this.active.set(-1);
    this.open.set(true);
  }

  protected keys(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.open.set(false);
      return;
    }
    const length = this.results().items.length;
    if (!length || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    this.open.set(true);
    this.active.update((index) => index < 0
      ? (event.key === 'ArrowDown' ? 0 : length - 1)
      : (index + (event.key === 'ArrowDown' ? 1 : length - 1)) % length);
  }

  protected submit(event: Event) {
    event.preventDefault();
    const selected = this.visible() ? this.results().items[this.active()] : undefined;
    this.open.set(false);
    if (selected) {
      void this.router.navigate(['/product', selected.slug]);
    } else {
      void this.router.navigate(['/catalog'], { queryParams: { q: this.text().trim() || null } });
    }
  }

  protected blur(event: FocusEvent, host: HTMLElement) {
    if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) this.open.set(false);
  }
}
