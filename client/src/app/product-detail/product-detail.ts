import { AmbientVisible } from '../motion/ambient-visible';
import { Magnetic } from '../motion/magnetic';
import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { apiMessage } from '../api-message';
import { WishlistButton } from '../shop/wishlist-button';
import { StockAlert } from '../shop/stock-alert';
import { DeliveryCheck } from './delivery-check';
import { ProductRecommendations } from './product-recommendations';
import { flyToCart } from '../cart/cart-flight';
import { CartStore } from '../cart/cart-store';
import { CatalogApi } from '../catalog/catalog-api';
import { categoryLabels, type Product, type RatingSummary } from '../catalog/product';
import { ShopState } from '../ui/shop-state';
import { ProductReviews } from './product-reviews';
import { StarSummary } from '../catalog/star-summary';
import { ProductMedia } from './product-media';
import { RcSpecs } from './rc-specs';
import { Seo } from '../seo/seo';

type DetailState = { status: 'loading' | 'missing' | 'error' } | { status: 'ready'; product: Product };
const loading: DetailState = { status: 'loading' };
const sections = ['Details', 'Specs', 'Shipping'] as const;
type Section = (typeof sections)[number];

@Component({
  selector: 'app-product-detail',
  imports: [AmbientVisible, Magnetic, CurrencyPipe, RouterLink, ProductMedia, WishlistButton, StockAlert, DeliveryCheck, ProductRecommendations, ShopState, ProductReviews, StarSummary, RcSpecs],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetail {
  protected readonly categoryLabels = categoryLabels;
  private readonly api = inject(CatalogApi);
  private readonly router = inject(Router);
  protected readonly cart = inject(CartStore);
  private readonly slug = toSignal(inject(ActivatedRoute).paramMap.pipe(
    map((params) => params.get('slug') ?? ''),
  ), { requireSync: true });

  private readonly attempt = signal(0);
  protected readonly detail = toSignal(
    combineLatest([toObservable(this.slug), toObservable(this.attempt)]).pipe(
      switchMap(([slug]) => this.api.getProduct(slug).pipe(
        map((product): DetailState => ({ status: 'ready', product })),
        catchError((error: unknown) => of<DetailState>({
          status: error instanceof HttpErrorResponse && error.status === 404 ? 'missing' : 'error',
        })),
        startWith(loading),
      )),
    ),
    { initialValue: loading },
  );

  protected readonly quantity = linkedSignal({ source: this.slug, computation: () => 1 });
  protected readonly panel = linkedSignal({ source: this.slug, computation: (): Section => 'Details' });
  protected readonly sections = sections;
  protected readonly adding = signal(false);
  protected readonly cartFeedback = signal<{ slug: string; message: string; error?: boolean } | null>(null);

  protected readonly reviewRequested = linkedSignal({ source: this.slug, computation: () => false });
  protected readonly reviewSummary = linkedSignal({ source: this.slug, computation: (): RatingSummary | null => null });

  constructor() {
    const seo = inject(Seo);
    effect(() => {
      const state = this.detail();
      if (state.status === 'ready') seo.setProduct(state.product);
    });
  }

  protected retry() { this.attempt.update((count) => count + 1); }

  protected setQuantity(value: number, stock: number) {
    this.quantity.set(Math.max(1, Math.min(value, stock, 99)));
  }

  protected moveTab(event: KeyboardEvent, list: HTMLElement) {
    const index = sections.indexOf(this.panel());
    const next = event.key === 'ArrowRight' ? (index + 1) % sections.length
      : event.key === 'ArrowLeft' ? (index - 1 + sections.length) % sections.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    this.panel.set(sections[next]);
    list.querySelectorAll('button')[next]?.focus();
  }

  protected async addToCart(product: Product, button: HTMLButtonElement) {
    if (this.adding() || this.cart.busy() || product.stock === 0) return;
    this.adding.set(true);
    this.cartFeedback.set(null);
    try {
      if (await this.cart.add(product.slug, this.quantity())) {
        const image = button.closest('main')?.querySelector<HTMLImageElement>('.gallery-image img');
        flyToCart(button, image?.currentSrc || product.images[0]);
        this.cartFeedback.set({ slug: product.slug, message: 'Added to cart.' });
      }
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        await this.signInFor(product);
      } else {
        this.cartFeedback.set({ slug: product.slug, message: apiMessage(error, 'This product could not be added. Try again.'), error: true });
      }
    } finally {
      this.adding.set(false);
    }
  }

  private signInFor(product: Product) {
    return this.router.navigate(['/login'], { queryParams: { returnUrl: '/product/' + product.slug } });
  }
}
