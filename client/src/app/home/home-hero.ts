import { CurrencyPipe } from '@angular/common';
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
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Product } from '../catalog/product';
import { Motion } from '../motion/motion';
import { ProductPreview, type PreviewPoint } from '../product-preview/product-preview';
import { EngineLoading } from '../ui/engine-loading';
import { GarageControls } from './garage/garage-controls';
import type { GarageZone } from './garage/garage-path';
import type { mountGarage } from './garage/garage-renderer';
import { observeGarage } from './garage/garage-session';
import { heroZoneAt, heroZones } from './garage/hero-garage-camera';
import { heroLayout, heroMotion } from './hero.config';
import { attachHeroScroll, playHeroEntrance } from './hero-scroll';

@Component({
  selector: 'app-home-hero',
  imports: [CurrencyPipe, RouterLink, GarageControls],
  templateUrl: './home-hero.html',
  styleUrls: ['./home-hero.css', './garage/garage-hero.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeHero {
  readonly category = input.required<GarageZone>();
  readonly preview = input<Product>();
  readonly ready = input(false);
  readonly products = input<readonly Product[]>([]);
  readonly categorySelected = output<GarageZone>();

  private readonly hero = viewChild.required<ElementRef<HTMLElement>>('hero');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly motion = inject(Motion);
  private readonly dom = inject(Renderer2);
  private readonly previewDialog = inject(ProductPreview);
  private readonly loading = inject(EngineLoading);
  private readonly plainPreview = computed(() => {
    const request = this.previewDialog.request();
    return Boolean(request && !request.viewerAvailable);
  });
  private readonly rendered = signal(false);
  private readonly entered = signal(false);
  private readonly supported = signal(false);
  private readonly reduced = computed(() => this.motion.level() === 'reduced');
  private readonly idleReady = signal(false);
  private readonly explore = signal(false);
  private readonly scene = signal<ReturnType<typeof mountGarage>>(null);
  private garage?: ReturnType<typeof observeGarage>;
  private scroll?: ReturnType<typeof attachHeroScroll>;
  private cancelEntrance?: () => void;
  private progress = 0;
  private pendingZone?: number;
  private swipe?: { id: number; x: number; y: number };

  protected readonly live = signal(false);
  protected readonly needsOptIn = computed(() => this.motion.level() === 'light');
  protected readonly explorationStatus = signal<'idle' | 'loading' | 'live' | 'unavailable'>(
    'idle',
  );
  protected readonly copyClearance = heroLayout.copyClearance;
  protected readonly hover = signal<{ product: Product; x: number; y: number } | undefined>(
    undefined,
  );
  protected readonly activeIndex = computed(() =>
    Math.max(
      0,
      heroZones.findIndex(({ category }) => category === this.category()),
    ),
  );

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const hero = this.hero().nativeElement;
      const view = hero.ownerDocument.defaultView;
      if (!view) return;
      const header = hero.ownerDocument.querySelector('app-store-header');
      let resizeFrame = 0;
      const updateHeight = () => {
        const height = header?.getBoundingClientRect().height ?? 0;
        hero.style.setProperty('--hero-header-height', height + 'px');
        this.scroll?.refresh();
      };
      const size =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
              if (resizeFrame) return;
              // A pin refresh can change scrollbar width. Keep it out of the resize delivery cycle.
              resizeFrame = view.requestAnimationFrame(() => {
                resizeFrame = 0;
                updateHeight();
              });
            })
          : undefined;
      if (header) size?.observe(header);
      updateHeight();
      this.rendered.set(true);
      let secondFrame = 0;
      let idle = 0;
      let timer = 0;
      const frame = view.requestAnimationFrame(() => {
        if (!hero.ownerDocument.documentElement.classList.contains('garage-intro-open'))
          this.enter();
        secondFrame = view.requestAnimationFrame(() => {
          const enable = () => this.idleReady.set(true);
          if (typeof view.requestIdleCallback === 'function') {
            idle = view.requestIdleCallback(enable, { timeout: 1600 });
          } else {
            timer = view.setTimeout(enable, 250);
          }
        });
      });
      destroy.onDestroy(() => {
        view.cancelAnimationFrame(frame);
        view.cancelAnimationFrame(secondFrame);
        if (idle) view.cancelIdleCallback(idle);
        if (timer) view.clearTimeout(timer);
        view.cancelAnimationFrame(resizeFrame);
        size?.disconnect();
        this.cancelEntrance?.();
      });
    });

    effect((cleanup) => {
      const manual = this.explore();
      if (
        !this.rendered() ||
        !this.entered() ||
        this.reduced() ||
        this.plainPreview() ||
        (!manual && (!this.idleReady() || this.needsOptIn()))
      )
        return;
      const garage = observeGarage({
        stage: this.stage().nativeElement,
        dom: this.dom,
        motion: this.motion,
        loading: this.loading,
        manual,
        scrollProgress: () => this.progress,
        activeIndex: () => this.activeIndex(),
        readProducts: () => this.products(),
        selectProduct: (product, point) => this.openProduct(product, undefined, point),
        hoverProduct: (item) => this.hover.set(item),
        onScene: (scene) => this.scene.set(scene),
        onLive: (live) => {
          this.live.set(live);
          if (live) {
            this.supported.set(true);
            if (manual) this.explorationStatus.set('live');
          } else this.hover.set(undefined);
        },
        onUnavailable: () => {
          this.supported.set(false);
          if (manual) this.explorationStatus.set('unavailable');
        },
      });
      this.garage = garage;
      cleanup(() => {
        garage?.destroy();
        this.garage = undefined;
      });
    });

    effect((cleanup) => {
      if (!this.entered() || !this.supported() || this.reduced()) return;
      const hero = this.hero().nativeElement;
      const headerHeight = () =>
        Number.parseFloat(hero.style.getPropertyValue('--hero-header-height')) || 0;
      let active = true;
      void this.motion.loadScrollTools().then((tools) => {
        if (!active || !tools) return;
        this.motion.zone.runOutsideAngular(() => {
          this.scroll = attachHeroScroll(hero, tools, headerHeight, (progress) => {
            this.progress = progress;
            const index = heroZoneAt(progress);
            this.garage?.scrollTo(progress, index);
            this.select(index);
          });
          if (this.pendingZone !== undefined) {
            this.scroll.jump(heroZones[this.pendingZone].center);
            this.pendingZone = undefined;
          }
        });
      });
      cleanup(() => {
        active = false;
        this.scroll?.destroy();
        this.scroll = undefined;
      });
    });

    effect(() => {
      const scene = this.scene();
      const products = this.products();
      if (scene) this.motion.zone.runOutsideAngular(() => scene.setFeatured(products));
    });
  }

  focusHeading(animated: boolean) {
    this.hero()
      .nativeElement.querySelector<HTMLElement>('#hero-title')
      ?.focus({ preventScroll: true });
    this.enter(animated);
  }

  private enter(animate = !this.needsOptIn()) {
    if (this.entered()) return;
    this.entered.set(true);
    if (animate && !this.reduced())
      this.cancelEntrance = playHeroEntrance(this.hero().nativeElement, false);
  }

  protected exploreGarage() {
    this.explorationStatus.set('loading');
    this.explore.set(true);
  }

  private select(index: number) {
    const category = heroZones[index].category;
    if (category !== this.category()) this.categorySelected.emit(category);
  }

  protected jump(index: number) {
    if (this.scroll) {
      this.scroll.jump(heroZones[index].center);
      return;
    }
    this.progress = heroZones[index].center;
    this.pendingZone = index;
    this.select(index);
    this.garage?.scrollTo(this.progress, index);
  }

  protected startSwipe(event: PointerEvent) {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    if (event.target instanceof Element && event.target.closest('a, button')) return;
    this.swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  protected endSwipe(event: PointerEvent) {
    const start = this.swipe;
    if (!start || start.id !== event.pointerId) return;
    this.swipe = undefined;
    if (event.type === 'pointercancel') return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) < Math.max(heroMotion.swipeDistancePx, Math.abs(y) * heroMotion.swipeAxisRatio))
      return;
    const next = this.activeIndex() + (x < 0 ? 1 : -1);
    if (next >= 0 && next < heroZones.length) this.jump(next);
  }

  protected skip(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = this.hero().nativeElement.ownerDocument.getElementById('featured');
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: this.reduced() ? 'instant' : 'smooth' });
  }

  protected openProduct(product: Product, source?: HTMLElement, point?: PreviewPoint) {
    this.hover.set(undefined);
    this.previewDialog.open({
      product,
      source:
        source ?? this.hero().nativeElement.querySelector<HTMLElement>('.hero-model') ?? undefined,
      point,
      ...this.garage?.inspect(product, point),
    });
  }
}
