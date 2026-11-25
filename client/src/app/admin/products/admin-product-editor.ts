import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap, tap, timer } from 'rxjs';
import { draftImages, draftMargin, prefillPatch } from './product-draft-display';
import { AdminProductDrafts } from './admin-product-drafts';
import { productRequestMessage } from './admin-product-feedback';
import { Toasts } from '../../ui/toasts';
import { AdminSessionStore } from '../admin-session-store';
import { AdminProductFields } from './admin-product-fields';
import { ProductPrefillComponent } from './import/product-prefill';
import { AdminProductMedia } from './admin-product-media';
import { ProductEditorNavigation } from './product-editor-navigation';
import { AdminProductStock } from './admin-product-stock';
import { focusFieldLink } from '../../ui/form-field/focus-field-link';
import {
  errorTarget,
  groupedIssues,
  ProductValidation,
  validationGroup,
  type Checklist,
} from './product-validation';
import {
  adminProductPath,
  categoriesFor,
  checklistDelayMs,
  generalFields,
  type ProductStatus,
  metadataFields,
  productApi,
  rcFields,
} from './admin-products.config';
import {
  draftFields,
  productLabel,
  productPayload,
  readIssues,
  type AdminImage,
  type AdminProductRecord,
} from './admin-product-types';

@Component({
  selector: 'app-admin-product-editor',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    RouterLink,
    AdminProductFields,
    AdminProductMedia,
    ProductPrefillComponent,
    AdminProductStock,
  ],
  host: { '(window:beforeunload)': 'navigation.beforeUnload($event)' },
  templateUrl: './admin-product-editor.html',
  styleUrl: './admin-products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductEditor {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyed = inject(DestroyRef);
  private readonly drafts = inject(AdminProductDrafts);
  private readonly account = inject(AdminSessionStore).session()?.email ?? '';
  private readonly api = inject(AdminSessionStore);
  private readonly toasts = inject(Toasts);
  protected readonly slug = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('slug'))),
    {
      initialValue: null,
    },
  );
  protected readonly editing = computed(() => Boolean(this.slug()));
  protected readonly groups = generalFields;
  protected readonly metadata = metadataFields;
  protected readonly productsPath = adminProductPath;
  protected readonly rcFields = rcFields;
  protected readonly label = (key: string) => validationGroup(key)?.label ?? productLabel(key);
  protected readonly fields = signal(draftFields());
  protected readonly images = signal<AdminImage[]>([]);
  protected readonly prefilled = signal<ReadonlySet<string>>(new Set());
  protected readonly glb = signal('');
  protected readonly imageUrl = signal('');
  protected readonly created = signal<AdminProductRecord | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal('');
  protected readonly validationError = signal(false);
  protected readonly validation = new ProductValidation();
  protected readonly errors = this.validation.visible;
  protected readonly publishingIssues = computed(() =>
    groupedIssues(this.validation.checked().issues),
  );
  protected readonly isGroup = (key: string) => !!validationGroup(key);
  protected readonly hasGroupError = (key: string) =>
    this.isGroup(key) && this.errors().some(({ field }) => field === key);
  protected readonly errorTarget = errorTarget;
  protected readonly focusLink = focusFieldLink;
  protected readonly status = computed(() => this.fields()['status'] as ProductStatus);
  protected readonly saved = signal(false);
  private readonly initialValues = signal('');
  private readonly dirty = computed(
    () => !this.loading() && !this.loadError() && this.initialValues() !== this.snapshot(),
  );
  private revision = 0;
  private activeSlug: string | null = null;
  readonly navigation = new ProductEditorNavigation(this.dirty, () =>
    this.drafts.discard(this.account, this.activeSlug),
  );
  protected readonly profit = computed(() => draftMargin(this.fields()));

  protected readonly checklist = rxResource({
    params: () =>
      this.loading() || this.loadError()
        ? undefined
        : productPayload(this.fields(), this.images(), this.glb(), false),
    stream: ({ params }) =>
      timer(checklistDelayMs).pipe(
        switchMap(() => this.api.request<Checklist>('POST', productApi + '/checklist', params)),
        tap((result) => this.validation.checked.set(result)),
      ),
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(() => void this.load(slug));
    });
  }

  protected fillFromFile(data: Partial<AdminProductRecord>) {
    const { patch, images, filled } = prefillPatch(data, this.fields()['productType']);
    this.fields.update((values) => ({ ...values, ...patch }));
    if (images) this.images.set(images);
    if (data.glbUrl) this.glb.set(data.glbUrl);
    this.prefilled.set(filled);
    this.remember();
  }

  private setProduct(product?: AdminProductRecord) {
    this.fields.set(draftFields(product));
    this.imageUrl.set('');
    this.images.set(draftImages(product) ?? []);
    this.glb.set(product?.glbUrl ?? '');
  }

  protected retry() {
    void this.load(this.slug());
  }

  private async load(slug: string | null) {
    const current = ++this.revision;
    this.activeSlug = slug;
    this.loading.set(true);
    this.created.set(null);
    this.error.set('');
    this.loadError.set('');
    this.saved.set(false);
    this.validation.reset();
    this.prefilled.set(new Set());
    try {
      const product = slug
        ? await this.api.request<AdminProductRecord>(
            'GET',
            productApi + '/' + encodeURIComponent(slug),
          )
        : undefined;
      if (current !== this.revision) return;
      this.setProduct(product);
      this.initialValues.set(this.snapshot());
      const draft = this.drafts.read(this.account, slug);
      if (draft) {
        this.fields.set(draft.fields);
        this.images.set(draft.images);
        this.glb.set(draft.glb);
        this.imageUrl.set(draft.imageUrl);
      }
    } catch (error) {
      if (current === this.revision)
        this.loadError.set(productRequestMessage(error, 'Could not load this product. Try again.'));
    } finally {
      if (current === this.revision) this.loading.set(false);
    }
  }

  private snapshot() {
    const { stock, ...fields } = this.fields();
    return JSON.stringify([
      fields,
      this.editing() ? null : stock,
      this.images(),
      this.glb(),
      this.imageUrl(),
    ]);
  }

  protected blur(key: string) {
    this.validation.publishing.set(this.status() === 'published');
    this.validation.blur(key);
  }

  protected updateStock(stock: number) {
    this.fields.update((draft) => ({ ...draft, stock: String(stock) }));
    if (this.dirty()) this.remember();
  }

  private remember() {
    this.saved.set(false);
    if (!this.account) return;
    this.drafts.save(this.account, this.activeSlug, {
      fields: this.fields(),
      images: this.images(),
      glb: this.glb(),
      imageUrl: this.imageUrl(),
    });
  }

  protected updateImageUrl(value: string) {
    this.imageUrl.set(value);
    this.remember();
  }

  protected updateImages(value: AdminImage[]) {
    this.images.set(value);
    this.validation.clear('images');
    this.validation.clear('imageAlts');
    this.remember();
  }

  protected updateModel(value: string) {
    this.glb.set(value);
    this.validation.clear('glbUrl');
    this.remember();
  }

  protected edit({ key, value }: { key: string; value: string }) {
    this.fields.update((previous) => ({
      ...previous,
      [key]: value,
      ...(key === 'productType' && { category: categoriesFor(value)[0].value }),
    }));
    if (key === 'status') this.validation.publishing.set(value === 'published');
    this.validation.clear(key);
    this.remember();
  }

  protected save(event: Event) {
    event.preventDefault();
    return this.saveAs(this.status());
  }

  protected async saveAs(status: ProductStatus) {
    if (this.saving() || this.uploading() || this.created()) return;
    this.edit({ key: 'status', value: status });
    this.saving.set(true);
    this.error.set('');
    this.validation.begin(status === 'published');
    const slug = this.slug();
    try {
      const url = slug ? productApi + '/' + encodeURIComponent(slug) : productApi;
      const product = await this.api.saveProduct<AdminProductRecord>(
        slug ? 'PATCH' : 'POST',
        url,
        productPayload(this.fields(), this.images(), this.glb(), Boolean(slug)),
      );
      this.toasts.show(slug ? 'Product saved.' : 'Product created.');
      this.drafts.discard(this.account, slug);
      if (this.destroyed.destroyed || slug !== this.activeSlug) return;
      this.setProduct(product);
      this.initialValues.set(this.snapshot());
      this.validation.reset();
      this.saved.set(true);
      if (!slug) {
        this.created.set(product);
        this.navigation.focusFeedback('#product-save-success');
      }
    } catch (error) {
      if (this.destroyed.destroyed || slug !== this.activeSlug) return;
      this.error.set(productRequestMessage(error, 'Could not save the product. Try again.'));
      const issues = readIssues(error);
      this.validationError.set(issues.length > 0);
      this.validation.fail(issues);
      this.navigation.focusFeedback('#product-save-error');
    } finally {
      this.saving.set(false);
    }
  }
}
