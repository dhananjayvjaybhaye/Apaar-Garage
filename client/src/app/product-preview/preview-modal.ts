import { DOCUMENT, CurrencyPipe } from '@angular/common';
import {
  afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, DestroyRef, ElementRef,
  inject, Injector, signal, viewChild,
} from '@angular/core';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import type { gsap } from 'gsap';
import { apiMessage } from '../api-message';
import { flyToCart } from '../cart/cart-flight';
import { CartStore } from '../cart/cart-store';
import { CatalogApi } from '../catalog/catalog-api';
import type { Product } from '../catalog/product';
import { Motion } from '../motion/motion';
import { ProductMedia } from '../product-detail/product-media';
import { StockAlert } from '../shop/stock-alert';
import { ProductPreview, type PreviewRequest } from './product-preview';
import { previewImageSizes } from './prefetch-product-media';

@Component({
  selector: 'app-preview-modal',
  imports: [CurrencyPipe, RouterLink, ProductMedia, StockAlert],
  templateUrl: './preview-modal.html',
  styleUrl: './preview-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewModal {
  private readonly service = inject(ProductPreview);
  private readonly catalog = inject(CatalogApi);
  private readonly motion = inject(Motion);
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly shell = viewChild.required<ElementRef<HTMLDialogElement>>('shell');
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly shade = viewChild.required<ElementRef<HTMLElement>>('shade');
  private readonly closer = viewChild.required<ElementRef<HTMLButtonElement>>('closer');

  protected readonly cart = inject(CartStore);
  protected readonly item = signal<Product | null>(null);
  protected readonly items = signal<readonly Product[]>([]);
  protected readonly quantity = signal(1);
  protected readonly feedback = signal('');
  protected readonly failed = signal(false);
  protected readonly closing = signal(false);
  protected readonly imageSizes = previewImageSizes;
  protected readonly canMountViewer = computed(() =>
    !this.closing() && (this.service.request()?.viewerAvailable?.() ?? true),
  );
  private readonly index = computed(() => this.items().findIndex((product) => product.slug === this.item()?.slug));
  protected readonly canPrevious = computed(() => this.index() > 0);
  protected readonly canNext = computed(() => this.index() >= 0 && this.index() < this.items().length - 1);
  private request?: PreviewRequest;
  private controller?: AbortController;
  private entrance?: gsap.core.Timeline;
  private fades: Animation[] = [];
  private listSubscription?: { unsubscribe(): void };

  constructor() {
    const previews = this.service.opened.subscribe((request) => this.open(request));
    const navigation = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.release(false);
    });
    inject(DestroyRef).onDestroy(() => {
      navigation.unsubscribe();
      previews.unsubscribe();
      this.release(false);
    });
  }

  private open(request: PreviewRequest) {
    request.prioritizeOverlay?.();
    this.controller?.abort();
    this.resetEntrance();
    const controller = new AbortController();
    this.controller = controller;
    this.request = request;
    this.item.set(request.product);
    this.items.set([request.product]);
    this.quantity.set(1);
    this.feedback.set('');
    this.failed.set(false);
    this.closing.set(false);
    this.listSubscription?.unsubscribe();
    const origin = request.source?.getBoundingClientRect();
    const point = request.point ?? (origin ? { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 } : undefined);
    this.doc.documentElement.classList.add('product-preview-lock');
    this.changeDetector.detectChanges();
    const dialog = this.shell().nativeElement;
    if (!dialog.open) dialog.showModal();
    this.surface().nativeElement.scrollTop = 0;
    this.closer().nativeElement.focus({ preventScroll: true });
    this.animateEntrance(request.animator, point);
    request.enter?.(controller.signal);
    this.listSubscription = this.catalog.getProducts({ category: request.product.category, limit: 48 }).subscribe({
      next: ({ items }) => this.items.set(items.some((item) => item.slug === request.product.slug)
        ? items : [request.product, ...items]),
      error: () => {},
    });
  }

  private animateEntrance(animator: PreviewRequest['animator'], point: PreviewRequest['point']) {
    const surface = this.surface().nativeElement;
    const shade = this.shade().nativeElement;
    const reduced = this.motion.level() === 'reduced';
    const bounds = surface.getBoundingClientRect();
    const x = point ? point.x - bounds.left - bounds.width / 2 : 0;
    const y = point ? point.y - bounds.top - bounds.height / 2 : 16;
    const scale = point ? 0.22 : 0.94;
    if (!animator || reduced) {
      this.fades = [
        shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? 150 : 250, fill: 'both' }),
        surface.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [
          { opacity: 0.22, transform: `perspective(950px) translate(${x}px, ${y}px) scale(${scale}) rotateX(-8deg)` },
          { opacity: 1, transform: 'none' },
        ], { duration: reduced ? 150 : 350, easing: 'ease-out', fill: 'both' }),
      ];
      return;
    }
    this.entrance = this.motion.zone.runOutsideAngular(() => animator.timeline()
      .fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0)
      .fromTo(surface, { x, y, scale, opacity: 0.22, rotationX: -8, rotationY: 5, transformPerspective: 950 }, {
        x: 0, y: 0, scale: 1, rotationX: 0, rotationY: 0, opacity: 1, duration: 0.35, ease: 'power2.out',
      }, 0)
      .fromTo(surface.querySelectorAll('[data-preview-enter]'), { opacity: 0.82, y: 5 }, {
        opacity: 1, y: 0, duration: 0.17, stagger: 0.035, ease: 'power2.out',
      }, 0));
  }

  private resetEntrance() {
    this.entrance?.revert();
    const surface = this.surface().nativeElement;
    this.request?.animator?.killTweensOf([surface, this.shade().nativeElement, ...surface.querySelectorAll('[data-preview-enter]')]);
    this.entrance = undefined;
    for (const fade of this.fades) fade.cancel();
    this.fades = [];
  }

  protected change(direction: number) {
    const result = this.items()[this.index() + direction];
    if (!result || this.closing() || this.cart.busy()) return;
    this.item.set(result);
    this.surface().nativeElement.scrollTop = 0;
    this.quantity.set(1);
    this.feedback.set('');
    this.failed.set(false);
    if (this.motion.level() !== 'reduced') {
      this.surface().nativeElement.querySelector('.preview-grid')?.animate(
        [{ opacity: 0.45 }, { opacity: 1 }], { duration: 150 },
      );
    }
  }

  protected adjust(amount: number) {
    const stock = this.item()?.stock ?? 0;
    this.quantity.update((quantity) => Math.max(1, Math.min(quantity + amount, stock, 99)));
  }

  protected async add(product: Product, button: HTMLButtonElement) {
    if (this.cart.busy() || this.closing()) return;
    this.feedback.set('');
    this.failed.set(false);
    try {
      if (await this.cart.add(product.slug, this.quantity())) {
        if (this.item()?.slug !== product.slug) return;
        this.feedback.set('Added to cart.');
        const image = this.surface().nativeElement.querySelector<HTMLImageElement>('.gallery-image img');
        flyToCart(button, image?.currentSrc || product.images[0], this.shell().nativeElement, image);
      }
    } catch (error) {
      if (this.item()?.slug !== product.slug) return;
      this.failed.set(true);
      this.feedback.set(apiMessage(error, 'Could not add this model. Try again.'));
    }
  }

  protected keyboard(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const focusable = [...this.surface().nativeElement.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
    )].filter((item) => !item.closest('[inert]') && item.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    const active = this.doc.activeElement;
    if (event.shiftKey ? active === first : active === last) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }

  protected backdrop(event: MouseEvent) {
    const moving = this.entrance?.isActive() || this.fades.some((fade) => fade.playState === 'running');
    if (this.request?.retarget?.({ x: event.clientX, y: event.clientY }, moving)) return;
    void this.close();
  }

  protected async close(event?: Event) {
    event?.preventDefault();
    const request = this.request;
    if (!request || this.closing()) return;
    this.closing.set(true);
    this.controller?.abort();
    const closing = new AbortController();
    this.controller = closing;
    const dialog = this.shell().nativeElement;
    // Release any preview canvas and start the garage return in the same render as the dialog reverse.
    afterNextRender(() => {
      if (!closing.signal.aborted) request.exit?.(closing.signal);
    }, { injector: this.injector });
    if (dialog.open) {
      if (this.entrance && this.entrance.time() > 0) {
        const timeline = this.entrance;
        await Promise.race([
          new Promise<void>((resolve) => {
            timeline.eventCallback('onReverseComplete', resolve);
            timeline.reverse();
          }),
          new Promise<void>((resolve) => closing.signal.addEventListener('abort', () => resolve(), { once: true })),
        ]);
      } else if (this.fades.length) {
        for (const fade of this.fades) fade.reverse();
        await Promise.allSettled(this.fades.map((fade) => fade.finished));
      }
    }
    if (!closing.signal.aborted && this.request === request) this.release(true);
  }

  private release(returnFocus: boolean) {
    const request = this.request;
    if (!request) return;
    if (!returnFocus) this.controller?.abort();
    this.listSubscription?.unsubscribe();
    this.resetEntrance();
    this.request = undefined;
    const dialog = this.shell().nativeElement;
    if (dialog.open) dialog.close();
    this.item.set(null);
    this.doc.documentElement.classList.remove('product-preview-lock');
    this.service.clear(request);
    if (returnFocus && request.source?.isConnected) request.source.focus({ preventScroll: true });
  }
}
