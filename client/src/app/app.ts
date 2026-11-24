import { PreviewModal } from './product-preview/preview-modal';
import { CursorGlow } from './motion/cursor-glow';
import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { StoreFooter } from './store-footer/store-footer';
import { StoreHeader } from './store-header/store-header';
import { StockNotices } from './shop/stock-notices';
import { RouterLink } from '@angular/router';
import { MobileNav } from './ui/mobile-nav';
import { ToastHost } from './ui/toasts';
import { EngineGauge } from './ui/engine-gauge';
import { EngineLoading } from './ui/engine-loading';
import { GarageAmbience } from './ui/garage-ambience';
import { AmbientBackground } from './ui/ambient-background/ambient-background';
import { Seo } from './seo/seo';
import { AfterFirstPaint } from './ui/after-first-paint';
import { Motion } from './motion/motion';
import { scrollOnStoreNavigation } from './store-route-scroll';

const calmRoutes = new Set([
  'cart',
  'checkout',
  'login',
  'register',
  'auth',
  'account',
  'orders',
  'track-order',
  'admin',
]);

@Component({
  selector: 'app-root',
  imports: [
    PreviewModal,
    CursorGlow,
    AmbientBackground,
    GarageAmbience,
    RouterOutlet,
    RouterLink,
    StoreHeader,
    StoreFooter,
    StockNotices,
    MobileNav,
    ToastHost,
    EngineGauge,
  ],
  template: `
    @defer (when decorationsReady()) {
      <app-ambient-background [calm]="calmBackground()" />
    }
    <a class="primary-button skip-link" href="#page-content" (click)="skip($event, content)"
      >Skip to content</a
    >
    @if (!adminArea()) {
      <app-store-header />
      <app-stock-notices />
      <app-mobile-nav />
    }
    <div #content id="page-content" class="route-content" tabindex="-1">
      @defer (when decorationsReady() && !calmBackground()) {
        @if (!calmBackground()) {
          <app-garage-ambience mode="site" />
        }
      }
      <router-outlet />
    </div>
    @if (!adminArea()) {
    <app-store-footer />
    <a
      class="secondary-button contact-float"
      [class.contact-inline]="purchaseRoute()"
      routerLink="/faq"
      fragment="contact"
      ><span class="icon icon-chat" aria-hidden="true"></span> Contact us</a
    >
    }
    <app-toasts />
    @defer (when decorationsReady() && showCursor()) {
      @if (showCursor()) {
        <app-cursor-glow />
      }
    }
    @if (!adminArea()) { <app-preview-modal /> }
    @if (engine(); as status) {
      <app-engine-gauge class="engine-dock" [status]="status" [compact]="true" />
    }
  `,
  styles:
    ':host { display: flex; flex-direction: column; min-height: 100svh; isolation: isolate; } .route-content { flex: 1 0 auto; min-height: calc(100svh - 4.6rem); }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    inject(Seo);
    scrollOnStoreNavigation();
  }

  protected readonly engine = inject(EngineLoading).state;
  protected readonly decorationsReady = inject(AfterFirstPaint).idle;
  private readonly motion = inject(Motion);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: inject(Location).path(true) || '/' },
  );
  private readonly page = computed(
    () => this.router.parseUrl(this.url()).root.children[PRIMARY_OUTLET]?.segments[0]?.path,
  );
  protected readonly adminArea = computed(() => this.page() === 'admin');
  protected readonly calmBackground = computed(() => calmRoutes.has(this.page() ?? ''));
  protected readonly purchaseRoute = computed(
    () => this.page() === 'product' || this.page() === 'checkout',
  );
  protected readonly showCursor = computed(
    () => !this.calmBackground() && this.motion.level() === 'full',
  );

  protected skip(event: Event, content: HTMLElement) {
    event.preventDefault();
    const main = content.querySelector('main') ?? content;
    if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: 'start' });
  }
}
