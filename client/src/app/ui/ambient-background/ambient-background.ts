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
} from '@angular/core';
import { ambientConfig, ambientStyles } from './ambient.config';
import { Motion } from '../../motion/motion';
import { createAmbientShapes } from './ambient-shapes';

@Component({
  selector: 'app-ambient-background',
  templateUrl: './ambient-background.html',
  styleUrl: './ambient-background.css',
  host: { 'aria-hidden': 'true', '[class.calm]': 'calm()', '[style]': 'palette' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmbientBackground {
  readonly calm = input(false);
  protected readonly palette = ambientStyles;
  private readonly motion = inject(Motion);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly allShapes = createAmbientShapes();
  protected readonly shapes = computed(() => {
    if (this.calm()) return [];
    return this.motion.level() === 'full'
      ? this.allShapes
      : this.allShapes.slice(0, ambientConfig.lightCount);
  });

  constructor() {
    const { ownerDocument: document, style } = this.host;
    const view = document.defaultView;
    const lifetime = inject(DestroyRef);
    let scrollRange = 0;
    let previousX = '';
    let previousY = '';
    style.setProperty('--glow-opacity', String(ambientConfig.cornerOpacity));
    style.setProperty('--calm-opacity', String(ambientConfig.calmOpacity));
    const update = () => {
      const level = this.motion.level();
      const active = view && !this.calm() && level !== 'reduced';
      const progress =
        active && scrollRange > 0 ? Math.min(1, Math.max(0, view.scrollY / scrollRange)) : 0;
      const scrollFactor = level === 'full' ? 1 : ambientConfig.lightScrollFactor;
      style.setProperty(
        '--ambient-scroll',
        progress * ambientConfig.scrollTravel * scrollFactor + 'px',
      );
      style.setProperty('--glow-travel', progress * ambientConfig.cornerTravel + '%');
      style.setProperty('--glow-mix', String(progress));
    };
    effect(() => {
      this.motion.level();
      this.calm();
      this.motion.schedule(this, update);
    });
    afterNextRender(() => {
      if (!view) return;
      const events = new AbortController();
      const queue = () => this.motion.schedule(this, update);
      const measure = () => {
        scrollRange = document.documentElement.scrollHeight - view.innerHeight;
        queue();
      };
      const visibility = () => {
        this.host.classList.toggle('paused', document.hidden);
        if (!document.hidden) measure();
      };
      const unsubscribe = this.motion.subscribe(({ pointer, width, height }) => {
        const full = pointer && !this.calm() && this.motion.level() === 'full';
        const x = (full ? (pointer.x / width - 0.5) * ambientConfig.mouseTravel : 0).toFixed(2);
        const y = (full ? (pointer.y / height - 0.5) * ambientConfig.mouseTravel : 0).toFixed(2);
        if (x === previousX && y === previousY) return;
        previousX = x;
        previousY = y;
        style.setProperty('--ambient-x', x + 'px');
        style.setProperty('--ambient-y', y + 'px');
      });
      let resize: ResizeObserver | undefined;
      this.motion.zone.runOutsideAngular(() => {
        document.addEventListener('visibilitychange', visibility, { signal: events.signal });
        view.addEventListener('scroll', queue, { signal: events.signal, passive: true });
        view.addEventListener('resize', measure, { signal: events.signal, passive: true });
        if (typeof ResizeObserver !== 'undefined' && this.host.parentElement) {
          resize = new ResizeObserver(measure);
          resize.observe(this.host.parentElement);
        }
        visibility();
      });
      lifetime.onDestroy(() => {
        events.abort();
        resize?.disconnect();
        unsubscribe();
        this.motion.cancel(this);
      });
    });
  }
}
