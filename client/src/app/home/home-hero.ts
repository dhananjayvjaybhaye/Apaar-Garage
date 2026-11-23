import { CurrencyPipe, DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  Renderer2,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Product } from '../catalog/product';
import { Motion } from '../motion/motion';
import { GarageSkeleton } from './garage/garage-skeleton';
import { isConstrainedDevice } from '../motion/motion-policy';
import { ProductPreview, type PreviewPoint } from '../product-preview/product-preview';
import { EngineLoading } from '../ui/engine-loading';
import { mediaQuery } from '../ui/media-query';
import type { GarageZone, RcBenchStatus } from './garage/garage-path';
import type { mountGarage } from './garage/garage-renderer';
import { observeGarage } from './garage/garage-session';
import { heroZones } from './garage/hero-garage-camera';
import { heroLayout, heroMotion, heroSteps } from './hero.config';
import { attachHeroInput, heroPosition, savedHeroZone } from './hero-scroll';
import { lastHeroZone } from './hero-gesture';
import { StoreHeaderSize } from '../store-header/store-header-size';
import { followHeroSection } from './hero-section-link';
import { firstGarageHint, watchHeroArrival } from './hero-arrival';
import { skipHeroToShop } from './hero-skip';
import { createHeroSwipe } from './hero-swipe';

@Component({
  selector: 'app-home-hero',
  imports: [CurrencyPipe, RouterLink, GarageSkeleton],
  templateUrl: './home-hero.html',
  styleUrls: ['./home-hero.css', './hero-hint.css', './garage/garage-hero.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeHero {
  readonly rcStatus = input<RcBenchStatus>('loading');
  readonly products = input<readonly Product[]>([]);
  readonly categorySelected = output<GarageZone>();

  private readonly hero = viewChild.required<ElementRef<HTMLElement>>('hero');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly motion = inject(Motion);
  private readonly headerHeight = inject(StoreHeaderSize).height;
  private readonly router = inject(Router);
  private readonly dom = inject(Renderer2);
  private readonly previewDialog = inject(ProductPreview);
  private readonly loading = inject(EngineLoading);
  private readonly plainPreview = computed(() => {
    const request = this.previewDialog.request();
    return Boolean(request && !request.viewerAvailable);
  });
  private readonly firstPaint = signal(false);
  private readonly entered = signal(false);
  private readonly reduced = computed(() => this.motion.level() === 'reduced');
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly wideGarage = mediaQuery(heroLayout.automaticGarageQuery, this.view);
  private readonly automatic = signal(this.canStartAutomatically());
  private readonly unavailable = signal(false);
  private readonly idleReady = signal(false);
  private readonly explore = signal(false);
  private readonly scene = signal<ReturnType<typeof mountGarage>>(null);
  private garage?: ReturnType<typeof observeGarage>;
  private steps?: ReturnType<typeof attachHeroInput>;
  private stepFailed = false;
  private cancelSkip?: () => void;
  private cancelSectionLink?: () => void;

  protected readonly live = signal(false);
  protected readonly stepEnabled = signal(false);
  protected readonly showHint = signal(false);
  protected readonly hintDismissed = signal(false);
  protected readonly needsOptIn = computed(() => !this.reduced() && !this.automatic());
  protected readonly showStatic = computed(
    () => this.reduced() || this.needsOptIn() || this.unavailable(),
  );
  protected readonly explorationStatus = signal<'idle' | 'loading' | 'live' | 'unavailable'>(
    'idle',
  );
  protected readonly copyClearance = heroLayout.copyClearance;
  protected readonly sceneFade = heroMotion.sceneFadeMs + 'ms';
  protected readonly hover = signal<{ product: Product; x: number; y: number } | undefined>(
    undefined,
  );
  protected readonly activeIndex = signal(0);
  protected readonly zones = heroZones;
  protected readonly zoneName = computed(() => {
    const zone = heroZones[this.activeIndex()];
    return zone.category === 'rc' ? 'RC Toys' : zone.name;
  });

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const stopArrival = watchHeroArrival({
        hero: this.hero().nativeElement,
        router: this.router,
        media: this.wideGarage,
        updateMode: () => this.automatic.set(this.canStartAutomatically()),
        entered: this.entered,
        enter: () => {
          this.entered.set(true);
          this.followSectionLink();
        },
        followSection: () => this.followSectionLink(),
        zone: this.activeIndex,
        synchronizeZone: () => this.synchronizeZone(),
        restoreZone: () => this.restoreZone(),
        paint: () => this.firstPaint.set(true),
        idle: () => this.idleReady.set(true),
      });
      destroy.onDestroy(() => {
        stopArrival();
        this.destroySteps();
        this.cancelSkip?.();
        this.cancelSectionLink?.();
      });
    });

    effect((cleanup) => {
      const manual = this.explore();
      if (
        !this.firstPaint() ||
        !this.entered() ||
        this.reduced() ||
        this.plainPreview() ||
        (!manual && (!this.idleReady() || !this.automatic()))
      )
        return;
      // The engine loader can already be visible during a restored start. Its state must not
      // become a dependency of the effect that owns the WebGL session.
      const garage = untracked(() =>
        observeGarage({
          stage: this.stage().nativeElement,
          dom: this.dom,
          motion: this.motion,
          loading: this.loading,
          manual,
          index: this.activeIndex,
          readProducts: () => this.products(),
          readRcStatus: () => this.rcStatus(),
          selectProduct: (product, point) => this.openProduct(product, point),
          hoverProduct: (item) => this.hover.set(item),
          onScene: (scene) => this.scene.set(scene),
          onLive: (live) => {
            this.live.set(live);
            if (live) {
              this.unavailable.set(false);
              if (manual) this.explorationStatus.set('live');
              else this.enableSteps();
            } else this.hover.set(undefined);
          },
          onUnavailable: () => {
            this.destroySteps();
            this.unavailable.set(true);
            if (manual) this.explorationStatus.set('unavailable');
          },
        }),
      );
      this.garage = garage;
      cleanup(() => {
        garage?.destroy();
        this.garage = undefined;
      });
    });

    effect(() => {
      if (this.reduced() || !this.automatic()) this.destroySteps();
    });

    effect(() => {
      const scene = this.scene();
      const products = this.products();
      const rcStatus = this.rcStatus();
      if (scene) this.motion.zone.runOutsideAngular(() => scene.setFeatured(products, rcStatus));
    });
  }

  focusHeading() {
    this.hero()
      .nativeElement.querySelector<HTMLElement>('#hero-title')
      ?.focus({ preventScroll: true });
    this.entered.set(true);
    this.followSectionLink();
  }

  private canStartAutomatically() {
    return !!(this.view && this.wideGarage?.matches && !isConstrainedDevice(this.view));
  }

  private checkedHistory = false;
  private restoredZone = false;
  private synchronizeZone() {
    if (!this.view || !this.automatic() || this.reduced() || this.steps || this.stepFailed) return;
    if (!this.checkedHistory) {
      this.checkedHistory = true;
      this.restoreZone();
    }
    if (
      !this.restoredZone &&
      this.view.scrollY >=
        heroPosition(this.hero().nativeElement, this.view, this.headerHeight()).end -
          heroSteps.settleTolerancePx
    )
      this.setZone(lastHeroZone);
  }

  private restoreZone() {
    if (!this.view || !this.automatic() || this.reduced()) return;
    const restored = savedHeroZone(this.view);
    if (restored === undefined) return;
    this.restoredZone = true;
    this.setZone(restored);
  }

  protected exploreGarage() {
    this.explorationStatus.set('loading');
    this.explore.set(true);
  }

  private enableSteps() {
    if (this.steps || this.stepFailed) return;
    this.steps = attachHeroInput({
      hero: this.hero().nativeElement,
      headerHeight: this.headerHeight,
      index: this.activeIndex,
      move: (index, done) => {
        this.hintDismissed.set(true);
        this.setZone(index, done);
        this.steps?.remember();
      },
      seek: (index) => this.setZone(index),
      fail: () => {
        this.stepFailed = true;
        this.destroySteps();
        this.garage?.setZone(this.activeIndex());
      },
    });
    this.stepEnabled.set(true);
    if (firstGarageHint(this.view)) this.showHint.set(true);
  }

  private destroySteps() {
    this.steps?.destroy();
    this.steps = undefined;
    this.stepEnabled.set(false);
  }

  private setZone(index: number, done?: () => void) {
    const previous = this.activeIndex();
    this.activeIndex.set(index);
    if (this.garage) this.garage.setZone(index, done);
    else done?.();
    if (index !== previous) this.categorySelected.emit(heroZones[index].category);
  }

  private followSectionLink() {
    this.cancelSectionLink?.();
    this.cancelSectionLink = followHeroSection(this.hero().nativeElement);
  }

  protected chooseStaticZone = (index: number) => this.setZone(index);
  protected readonly swipe = createHeroSwipe((direction, vertical) => {
    if (this.steps) this.steps.swipe(direction);
    else if (!vertical) {
      const next = this.activeIndex() + direction;
      if (next >= 0 && next < heroZones.length) this.setZone(next);
    }
  });

  protected skip(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = this.hero().nativeElement.ownerDocument.getElementById('featured');
    if (!target) return;
    event.preventDefault();
    this.cancelSkip?.();
    this.steps?.cancelTravel();
    this.cancelSkip = skipHeroToShop(target, this.reduced());
  }

  private openProduct(product: Product, point: PreviewPoint) {
    this.hover.set(undefined);
    this.previewDialog.open({
      product,
      source: this.hero().nativeElement.querySelector<HTMLElement>('#hero-title') ?? undefined,
      point,
      ...this.garage?.inspect(product, point),
    });
  }
}
