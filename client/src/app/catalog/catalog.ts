import { AmbientVisible } from '../motion/ambient-visible';
import { Reveal } from '../reveal';
import { Magnetic } from '../motion/magnetic';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, type ParamMap, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { CatalogApi, type CatalogQuery } from './catalog-api';
import {
  categoryLabels, categoryType, controlTypes, diecastCategories, rcCategories, skillLevels, terrains,
  type ProductPage, type ProductType,
} from './product';
import { ShopState } from '../ui/shop-state';
import { ProductCard } from './product-card';

const categories = [...diecastCategories, ...rcCategories];
const sorts = ['featured', 'newest', 'price-asc', 'price-desc', 'name', 'popular'];
const productTypes = ['diecast', 'rc'] as const;
const rcFilters = [
  { key: 'skillLevel', label: 'Skill level', options: skillLevels },
  { key: 'controlType', label: 'Control type', options: controlTypes },
  { key: 'terrain', label: 'Terrain', options: terrains },
] as const;

function option<T extends string>(value: string | null, choices: readonly T[]) {
  return choices.find((choice) => choice === value);
}

function readQuery(params: ParamMap): CatalogQuery {
  const category = option(params.get('category'), categories);
  const explicitType = option(params.get('productType'), productTypes);
  const productType = explicitType ?? (category && categoryType(category));
  const age = params.get('age');
  const battery = params.get('batteryIncluded');
  const sort = params.get('sort') ?? '';
  const page = Number(params.get('page'));
  const readPrice = (key: string) => {
    const value = params.get(key) ?? '';
    return /^\d{1,9}(?:\.\d{1,2})?$/.test(value) ? value : undefined;
  };
  return {
    productType,
    category: category && categoryType(category) === productType ? category : undefined,
    ...(productType === 'rc' && {
      skillLevel: option(params.get('skillLevel'), skillLevels),
      controlType: option(params.get('controlType'), controlTypes),
      terrain: option(params.get('terrain'), terrains),
      age: age && /^[1-9]\d?$/.test(age) ? Number(age) : undefined,
      batteryIncluded: battery === 'true' ? true : battery === 'false' ? false : undefined,
    }),
    brand: params.get('brand')?.trim().slice(0, 100),
    scale: /^1:[1-9]\d*$/.test(params.get('scale') ?? '') ? params.get('scale')! : undefined,
    q: params.get('q')?.slice(0, 80),
    minPrice: readPrice('minPrice'),
    maxPrice: readPrice('maxPrice'),
    sort: sorts.includes(sort) ? sort : undefined,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    limit: 8,
    facets: true,
    inStock: params.get('inStock') === 'true' ? true : undefined,
  };
}

type CatalogState = { status: 'loading' | 'error' } | { status: 'ready'; result: ProductPage };

@Component({
  selector: 'app-catalog',
  imports: [AmbientVisible, Reveal, Magnetic, RouterLink, ProductCard, ShopState],
  templateUrl: './catalog.html',
  styleUrl: './catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalog {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(CatalogApi);
  private pendingFilters?: Record<string, string | number | null>;
  private readonly retryRequest = signal(0);
  private readonly retries = toObservable(this.retryRequest);
  private readonly params = this.route.queryParamMap.pipe(map(readQuery));
  protected readonly query = toSignal(this.params, { requireSync: true });
  protected readonly labels = categoryLabels;
  protected readonly typeChoices = [
    { value: null, label: 'All products' },
    { value: 'diecast', label: 'Diecast' },
    { value: 'rc', label: 'RC Toys' },
  ] as const;
  protected readonly categories = computed(() => this.query().productType === 'rc' ? rcCategories : diecastCategories);
  protected readonly rcFilters = rcFilters;
  protected readonly chips = computed(() => {
    const query = this.query();
    return [
      { key: 'q', label: query.q ? 'Search: ' + query.q : '' },
      { key: 'category', label: query.category ? categoryLabels[query.category] : '' },
      { key: 'brand', label: query.brand },
      { key: 'scale', label: query.scale },
      { key: 'minPrice', label: query.minPrice ? 'From ₹' + query.minPrice : '' },
      { key: 'maxPrice', label: query.maxPrice ? 'Up to ₹' + query.maxPrice : '' },
      { key: 'inStock', label: query.inStock ? 'In stock' : '' },
      ...rcFilters.map(({ key, label }) => ({ key, label: query[key] && label + ': ' + query[key] })),
      { key: 'age', label: query.age ? 'Suitable for age ' + query.age : '' },
      { key: 'batteryIncluded', label: query.batteryIncluded === undefined ? '' : query.batteryIncluded ? 'Battery included' : 'Battery not included' },
    ].filter((chip) => chip.label);
  });

  protected readonly facets = signal({ brands: [] as string[], scales: [] as string[] });
  protected readonly filtersOpen = signal(false);
  protected readonly priceError = signal('');
  protected readonly state = toSignal(
    combineLatest([this.params, this.retries]).pipe(
      switchMap(([query]) => this.load(query)),
    ),
    { initialValue: { status: 'loading' } as CatalogState },
  );

  protected change(params: Record<string, string | number | null>) {
    this.priceError.set('');
    const next = { ...this.pendingFilters, page: null, ...params };
    this.pendingFilters = next;
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: next, queryParamsHandling: 'merge',
    }).finally(() => {
      if (this.pendingFilters === next) this.pendingFilters = undefined;
    });
  }

  protected removeFilter(key: string) {
    if (key === 'category') {
      this.change({ category: null, productType: this.query().productType ?? null });
    } else {
      this.change({ [key]: null });
    }
  }

  protected changeType(productType: ProductType | null) {
    this.change({
      productType, category: null, brand: null, scale: null,
      skillLevel: null, controlType: null, terrain: null, age: null, batteryIncluded: null,
    });
  }

  protected changeAge(input: HTMLInputElement) {
    if (input.reportValidity()) this.change({ age: input.value || null });
  }

  protected changeOption(key: string, value: string) {
    this.change({ [key]: value || null });
  }

  protected applyPrice(event: Event, min: string, max: string) {
    event.preventDefault();
    if (min !== '' && max !== '' && Number(max) < Number(min)) {
      this.priceError.set('Maximum price must be at least the minimum price.');
      return;
    }
    this.change({ minPrice: min || null, maxPrice: max || null });
  }

  protected retry() { this.retryRequest.update((value) => value + 1); }

  private load(query: CatalogQuery) {
    const request = query.category ? { ...query, productType: undefined } : query;
    return this.api.getProducts(request).pipe(
        tap(({ facets }) => { if (facets) this.facets.set(facets); }),
        map((result): CatalogState => ({ status: 'ready', result })),
        catchError(() => of<CatalogState>({ status: 'error' })),
        startWith<CatalogState>({ status: 'loading' }),
    );
  }
}
