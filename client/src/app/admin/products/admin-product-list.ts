import { AdminProductDrafts } from './admin-product-drafts';
import { draftFields, type AdminProductSummary } from './admin-product-types';
import { FormField, FieldControl } from '../../ui/form-field/form-field';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { from } from 'rxjs';
import { apiMessage } from '../../api-message';
import { Toasts } from '../../ui/toasts';
import { AdminSessionStore } from '../admin-session-store';
import {
  adminProductPath,
  categoriesFor,
  complianceOptions,
  productApi,
  productStatusOptions,
  sortOptions,
  stockOptions,
  typeOptions,
} from './admin-products.config';
import {
  type AdminProductPage,
  type AdminProductRecord,
  type AdminProductIssue,
  productLabel,
  readIssues,
} from './admin-product-types';

const filterKeys = [
  'q',
  'productType',
  'category',
  'status',
  'stock',
  'compliance',
  'sort',
] as const;
type FilterKey = (typeof filterKeys)[number];
type Filters = Record<FilterKey, string>;

@Component({
  selector: 'app-admin-product-list',
  imports: [FormField, FieldControl, CurrencyPipe, TitleCasePipe, RouterLink],
  templateUrl: './admin-product-list.html',
  styleUrl: './admin-products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductList {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AdminSessionStore);
  private readonly toasts = inject(Toasts);
  protected readonly types = typeOptions;
  protected readonly statuses = productStatusOptions;
  protected readonly stockOptions = stockOptions;
  protected readonly complianceOptions = complianceOptions;
  protected readonly styles = sortOptions;
  protected readonly label = productLabel;
  protected readonly filters = signal<Filters>(this.readFilters());
  protected readonly applied = signal<Filters>(this.filters());
  protected readonly page = signal(1);
  protected readonly categories = computed(() =>
    this.filters().productType
      ? categoriesFor(this.filters().productType)
      : [...categoriesFor('diecast'), ...categoriesFor('rc')],
  );
  protected readonly selected = signal(new Set<string>());
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly issues = signal<AdminProductIssue[]>([]);
  protected readonly listing = rxResource({
    params: () => ({ ...this.applied(), page: this.page().toString() }),
    stream: ({ params }) =>
      from(
        this.api.request<AdminProductPage>(
          'GET',
          productApi +
            '?' +
            new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString(),
        ),
      ),
  });

  private readFilters(): Filters {
    const params = this.route.snapshot.queryParamMap;
    return Object.fromEntries(
      filterKeys.map((key) => [key, params.get(key) ?? (key === 'sort' ? 'newest' : '')]),
    ) as Filters;
  }

  protected editFilter(key: FilterKey, value: string) {
    this.filters.update((previous) => ({
      ...previous,
      [key]: value,
      ...(key === 'productType' && { category: '' }),
    }));
  }

  protected apply(event: Event) {
    event.preventDefault();
    this.applied.set(this.filters());
    this.setPage(1);
  }

  protected setPage(page: number) {
    this.page.set(page);
    this.selected.set(new Set());
    this.error.set('');
    this.issues.set([]);
  }

  protected toggle(slug: string, checked: boolean) {
    this.selected.update((old) => {
      const next = new Set(old);
      if (checked) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }

  protected all(checked: boolean, page: AdminProductPage) {
    this.selected.set(new Set(checked ? page.items.map(({ slug }) => slug) : []));
  }

  protected async bulk(status: 'hidden' | 'published') {
    const slugs = [...this.selected()];
    if (!slugs.length || this.busy()) return;
    const verb = status === 'hidden' ? 'Hide' : 'Publish';
    if (!window.confirm(verb + ' ' + slugs.length + ' selected product(s)?')) return;
    this.busy.set(true);
    this.error.set('');
    this.issues.set([]);
    try {
      const { updated } = await this.api.request<{ updated: number }>(
        'PATCH',
        productApi + '/bulk-status',
        { slugs, status },
      );
      this.toasts.show(`${updated} product(s) updated.`);
      this.selected.set(new Set());
      this.listing.reload();
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not update the selection.'));
      this.issues.set(readIssues(error));
    } finally {
      this.busy.set(false);
    }
  }

  private readonly drafts = inject(AdminProductDrafts);
  protected readonly duplicateSource = signal<AdminProductSummary | null>(null);

  protected async duplicate(slug: string, includeImages: boolean) {
    if (this.busy()) return;
    const account = this.api.session()?.email ?? '';
    if (
      !includeImages &&
      this.drafts.read(account, null) &&
      !window.confirm('Replace the unsaved product draft?')
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      const copy = await this.api.request<AdminProductRecord>(
        'POST',
        productApi + '/' + encodeURIComponent(slug) + '/duplicate',
        { includeImages, suggestSku: true },
      );
      this.duplicateSource.set(null);
      if (!includeImages) {
        this.drafts.save(account, null, {
          fields: draftFields(copy),
          images: [],
          glb: copy.glbUrl ?? '',
          imageUrl: '',
        });
        this.toasts.show('Draft details copied. Add a photo and save when ready.');
        await this.router.navigate([adminProductPath, 'new']);
        return;
      }
      this.toasts.show('Draft copy created.');
      await this.router.navigate([adminProductPath, copy.slug]);
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not duplicate the product.'));
    } finally {
      this.busy.set(false);
    }
  }
}
