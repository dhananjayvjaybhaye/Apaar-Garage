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
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Product } from '../catalog/product';
import { ProductCard } from '../catalog/product-card';
import { Motion } from '../motion/motion';
import { ProductPreview, type PreviewPoint } from '../product-preview/product-preview';
import { EngineLoading } from '../ui/engine-loading';
import { responsiveImage } from '../ui/responsive-image';
import { GarageCanvasSlot } from './garage/garage-canvas-slot';
import { GarageControls } from './garage/garage-controls';
import type { GarageZone } from './garage/garage-path';
import type { mountGarage } from './garage/garage-renderer';
import { observeGarage } from './garage/garage-session';
import { watchTour } from './garage-tour-scroll';
import { tourConfig } from './garage-tour.config';
import { TourAtmosphere } from './tour-atmosphere';

export interface GarageTourStop {
  id: GarageZone;
  name: string;
  note: string;
  image: string;
  items: readonly Product[];
  loading: boolean;
}

@Component({
  selector: 'app-garage-tour',
  imports: [GarageControls, ProductCard, RouterLink, TourAtmosphere],
  templateUrl: './garage-tour.html',
  styleUrls: ['./garage-tour.css', './garage/garage-hero.css'],
  host: { '[style]': 'layout' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarageTour {
  readonly stops = input.required<readonly GarageTourStop[]>();
  readonly products = input.required<readonly Product[]>();

  private readonly course = viewChild.required<ElementRef<HTMLElement>>('course');
  private readonly rail = viewChild.required<ElementRef<HTMLElement>>('rail');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly motion = inject(Motion);
  private readonly dom = inject(Renderer2);
  private readonly preview = inject(ProductPreview);
  private readonly loading = inject(EngineLoading);
  private readonly slot = inject(GarageCanvasSlot);
  protected readonly engaged = signal(false);
  private readonly scene = signal<ReturnType<typeof mountGarage>>(null);
  private readonly reduced = computed(() => this.motion.level() === 'reduced');
  private readonly plainPreview = computed(() => {
    const request = this.preview.request();
    return Boolean(request && !request.viewerAvailable);
  });
  private scroll?: ReturnType<typeof watchTour>;
  private garage?: ReturnType<typeof observeGarage>;
  private progress = 0;

  protected readonly activeIndex = signal(0);
  protected readonly live = signal(false);
  protected readonly active = computed(() => this.stops()[this.activeIndex()]);
  protected readonly imageSet = responsiveImage;
  protected readonly layout = {
    '--tour-desktop-stage': tourConfig.desktopStageHeight,
    '--tour-controls-clearance': tourConfig.desktopControlsClearance,
    '--tour-mobile-stage': tourConfig.mobileStageHeight,
    '--tour-block-height': tourConfig.blockHeight,
    '--tour-photo-fade': tourConfig.imageFadeMs + 'ms',
    '--tour-reduced-fade': tourConfig.reducedFadeMs + 'ms',
    '--tour-reveal': tourConfig.revealMs + 'ms',
    '--tour-chip-ms': tourConfig.chipMs + 'ms',
    '--tour-glow-opacity': tourConfig.glowOpacity,
    '--tour-beam-opacity': tourConfig.beamOpacity,
    '--tour-depth-opacity': tourConfig.depthOpacity,
    '--tour-dust-opacity': tourConfig.dustOpacity,
    '--tour-glow-loop': tourConfig.glowLoopSeconds + 's',
    '--tour-beam-loop': tourConfig.beamLoopSeconds + 's',
    '--tour-dust-loop': tourConfig.dustLoopSeconds + 's',
  };

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      this.scroll = this.motion.zone.runOutsideAngular(() =>
        watchTour(
          this.course().nativeElement,
          this.rail().nativeElement,
          (index, engaged) => {
            if (index >= 0) this.activeIndex.set(index);
            this.engaged.set(engaged);
          },
          (progress) => {
            this.progress = progress;
            this.garage?.scrollTo(progress, this.activeIndex());
          },
        ),
      );
      const scroll = this.scroll;
      void this.motion.loadScrollTools().then((tools) => {
        if (tools) this.motion.zone.runOutsideAngular(() => scroll.animate(tools));
      });
      destroy.onDestroy(() => this.scroll?.destroy());
    });

    effect((cleanup) => {
      if (!this.engaged() || this.reduced() || this.plainPreview()) return;
      const garage = observeGarage({
        stage: this.stage().nativeElement,
        dom: this.dom,
        motion: this.motion,
        loading: this.loading,
        slot: this.slot,
        scrollProgress: () => this.progress,
        allowMobile: true,
        activeIndex: () => this.activeIndex(),
        readProducts: () => this.products(),
        push: () => 0,
        dolly: () => 0,
        selectProduct: (product, point) => this.openProduct(product, undefined, point),
        onScene: (scene) => this.scene.set(scene),
        onLive: (live) => this.live.set(live),
      });
      this.garage = garage;
      cleanup(() => {
        garage?.destroy();
        this.garage = undefined;
      });
    });

    effect(() => {
      const scene = this.scene();
      const products = this.products();
      if (scene) this.motion.zone.runOutsideAngular(() => scene.setFeatured(products));
    });
  }

  protected jump(index: number) {
    this.scroll?.scrollTo(index);
  }

  protected openProduct(product: Product, source?: HTMLElement, point?: PreviewPoint) {
    this.preview.open({
      product,
      source:
        source ?? this.rail().nativeElement.querySelector<HTMLElement>('.hero-model') ?? undefined,
      point,
      ...this.garage?.inspect(product, point),
    });
  }
}
