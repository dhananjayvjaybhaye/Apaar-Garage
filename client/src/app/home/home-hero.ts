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
import { ProductPreview, type PreviewPoint } from '../product-preview/product-preview';
import type { Product } from '../catalog/product';
import { Motion } from '../motion/motion';
import { EngineLoading } from '../ui/engine-loading';
import { GarageAmbience } from '../ui/garage-ambience';
import { zones, type GarageZone } from './garage/garage-path';
import type { mountGarage } from './garage/garage-renderer';
import { observeGarage } from './garage/garage-session';
import { GarageControls } from './garage/garage-controls';
import { GarageCanvasSlot } from './garage/garage-canvas-slot';
import { heroLayout } from './hero.config';
import { attachHeroScroll, playHeroEntrance } from './hero-scroll';

@Component({
  selector: 'app-home-hero',
  imports: [RouterLink, GarageAmbience, GarageControls],
  templateUrl: './home-hero.html',
  styleUrls: ['./home-hero.css', './garage/garage-hero.css'],
  host: { '[style]': 'layout' },
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
  private readonly slot = inject(GarageCanvasSlot);
  private readonly plainPreview = computed(() => {
    const request = this.previewDialog.request();
    return Boolean(request && !request.viewerAvailable);
  });
  private readonly rendered = signal(false);
  private readonly reduced = computed(() => this.motion.level() === 'reduced');
  private readonly scene = signal<ReturnType<typeof mountGarage>>(null);
  private garage?: ReturnType<typeof observeGarage>;
  private touchStart?: { id: number; x: number; y: number };
  private cameraPush = 0;
  private dolly = 0;
  private entered = false;
  private cancelEntrance?: () => void;

  protected readonly live = signal(false);
  protected readonly activeIndex = computed(() =>
    Math.max(
      0,
      zones.findIndex(({ category }) => category === this.category()),
    ),
  );
  protected readonly layout = {
    '--hero-max-width': heroLayout.maxWidth,
    '--hero-height': heroLayout.height,
    '--hero-mobile-scene': heroLayout.mobileScene,
    '--hero-desktop-scene': heroLayout.desktopScene,
  };

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      this.rendered.set(true);
      const hero = this.hero().nativeElement;
      const view = hero.ownerDocument.defaultView;
      if (!view) return;
      const frame = view.requestAnimationFrame(() => {
        if (!hero.ownerDocument.documentElement.classList.contains('garage-intro-open'))
          this.enter();
      });
      destroy.onDestroy(() => {
        view.cancelAnimationFrame(frame);
        this.cancelEntrance?.();
      });
    });
    effect((cleanup) => {
      if (!this.rendered() || this.reduced() || this.plainPreview()) return;
      const garage = observeGarage({
        stage: this.stage().nativeElement,
        dom: this.dom,
        motion: this.motion,
        loading: this.loading,
        slot: this.slot,
        activeIndex: () => this.activeIndex(),
        readProducts: () => this.products(),
        push: () => this.cameraPush,
        dolly: () => this.dolly,
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

    effect((cleanup) => {
      if (!this.rendered() || this.reduced()) return;
      const hero = this.hero().nativeElement;
      let active = true;
      let detach: (() => void) | undefined;
      void this.motion.loadScrollTools().then((tools) => {
        if (!active || !tools) return;
        this.motion.zone.runOutsideAngular(() => {
          detach = attachHeroScroll(hero, tools, (value) => {
            this.dolly = value;
            this.scene()?.setDolly(value);
          });
        });
      });
      cleanup(() => {
        active = false;
        detach?.();
      });
    });

    effect(() => {
      const scene = this.scene();
      const products = this.products();
      if (scene) this.motion.zone.runOutsideAngular(() => scene.setFeatured(products));
    });
  }

  readonly pushIn = (amount: number) => {
    this.cameraPush = amount;
    this.scene()?.pushIn(amount);
    this.hero().nativeElement.style.setProperty('--hero-intro-scale', String(1 + amount * 0.04));
  };

  focusHeading() {
    this.hero()
      .nativeElement.querySelector<HTMLElement>('#hero-title')
      ?.focus({ preventScroll: true });
    this.enter();
  }

  private enter() {
    if (this.entered) return;
    this.entered = true;
    this.cancelEntrance = playHeroEntrance(this.hero().nativeElement, this.reduced());
  }

  protected jump(index: number) {
    this.categorySelected.emit(zones[index].category);
    this.garage?.select(index);
  }

  protected skip(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = this.hero().nativeElement.ownerDocument.getElementById('featured');
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: this.reduced() ? 'instant' : 'smooth' });
  }

  protected startSwipe(event: PointerEvent) {
    if (
      event.pointerType === 'touch' &&
      !(event.target instanceof Element && event.target.closest('a, button'))
    )
      this.touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  protected endSwipe(event: PointerEvent) {
    const start = this.touchStart;
    this.touchStart = undefined;
    if (!start || event.pointerId !== start.id || event.type === 'pointercancel') return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    this.jump(this.neighbor(dx < 0 ? 1 : -1));
  }

  private neighbor(direction: number) {
    return Math.max(0, Math.min(zones.length - 1, this.activeIndex() + direction));
  }

  protected openProduct(product: Product, source?: HTMLElement, point?: PreviewPoint) {
    const accessibleSource =
      source ?? this.hero().nativeElement.querySelector<HTMLElement>('.hero-model') ?? undefined;
    this.previewDialog.open({
      product,
      source: accessibleSource,
      point,
      ...this.garage?.inspect(product, point),
    });
  }
}
