import { DOCUMENT } from '@angular/common';
import {
  afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject,
  input, output, signal, viewChild,
} from '@angular/core';
import type { gsap } from 'gsap';
import { Motion } from '../../motion/motion';
import { EngineGauge } from '../../ui/engine-gauge';
import { EngineLoading } from '../../ui/engine-loading';
import { GarageSound } from '../../ui/garage-sound';

const enteredKey = 'apaar-garage-entered';

@Component({
  selector: 'app-garage-intro',
  imports: [EngineGauge],
  templateUrl: './garage-intro.html',
  styleUrl: './garage-intro.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarageIntro {
  readonly pushCamera = input.required<(amount: number) => void>();
  readonly closed = output<void>();
  private readonly motion = inject(Motion);
  private readonly document = inject(DOCUMENT);
  private readonly sound = inject(GarageSound);
  private readonly engine = inject(EngineLoading);
  private readonly modal = viewChild<ElementRef<HTMLDialogElement>>('modal');
  private readonly skipControl = viewChild<ElementRef<HTMLButtonElement>>('skipControl');
  private animation?: gsap.core.Timeline;
  private alive = true;

  protected readonly visible = signal(this.shouldShow());
  protected readonly opening = signal(false);
  protected readonly loading = this.engine.state;
  protected readonly slats = Array.from({ length: 16 }, (_, index) => index);

  constructor() {
    afterNextRender(() => {
      const dialog = this.modal()?.nativeElement;
      if (!dialog || !this.visible()) return;
      dialog.showModal();
      this.document.documentElement.classList.add('garage-intro-open');
      void this.motion.loadScrollTools();
    });
    effect(() => {
      if (this.visible() && this.motion.level() === 'reduced') this.finish();
    });
    inject(DestroyRef).onDestroy(() => {
      this.alive = false;
      this.animation?.kill();
      if (this.opening()) this.sound.stopIntro();
      this.document.documentElement.classList.remove('garage-intro-open');
    });
  }

  protected enter() {
    if (this.opening()) return;
    this.remember();
    this.opening.set(true);
    this.skipControl()?.nativeElement.focus({ preventScroll: true });
    this.sound.enter();
    void this.motion.loadScrollTools().then((tools) => {
      if (!this.alive || !this.visible()) return;
      if (tools) this.rollUp(tools.gsap);
      else this.finish();
    });
  }

  protected skip(event?: Event) {
    event?.preventDefault();
    this.remember();
    if (this.opening()) this.sound.stopIntro();
    this.sound.click();
    this.finish();
  }

  private rollUp(animator: typeof gsap) {
    const dialog = this.modal()?.nativeElement;
    if (!dialog) return this.finish();
    const slats = dialog.querySelectorAll<HTMLElement>('.door-slat');
    const height = slats[0].getBoundingClientRect().height;
    const inside = animator.utils.selector(dialog);
    const camera = { push: 0 };
    this.animation = this.motion.zone.runOutsideAngular(() => animator.timeline({
      onComplete: () => this.motion.zone.run(() => this.finish()),
    })
      .to(inside('.intro-copy'), { opacity: 0, y: -14, duration: .25 }, 0)
      .to(inside('.door-shade'), { opacity: 0, duration: 1.6, ease: 'power2.out' }, .13)
      .to(slats, {
        y: (index: number) => index * (2 - height), scaleY: .12, transformOrigin: '50% 0%',
        duration: 1.49, ease: 'power2.inOut', stagger: { each: .014, from: 'end' },
      }, .05)
      .to(inside('.bottom-light'), { scaleY: 18, opacity: .55, duration: .8, ease: 'power2.out' }, .14)
      .to(inside('.amber-haze'), { opacity: .8, scale: 1.24, duration: .73, ease: 'sine.out' }, .27)
      .to(inside('.amber-haze, .bottom-light'), { opacity: 0, duration: .77 }, 1.15)
      .to(camera, { push: 1, duration: 1.23, ease: 'power2.inOut', onUpdate: () => this.pushCamera()(camera.push) }, .18)
      .to(camera, { push: 0, duration: .53, ease: 'sine.inOut', onUpdate: () => this.pushCamera()(camera.push) }, 1.42)
      .to(inside('.door-slats'), { yPercent: -10, opacity: 0, duration: .25 }, 1.68));
  }

  private finish() {
    if (!this.visible()) return;
    this.animation?.kill();
    this.pushCamera()(0);
    this.modal()?.nativeElement.close();
    this.document.documentElement.classList.remove('garage-intro-open');
    this.visible.set(false);
    this.closed.emit();
  }

  private shouldShow() {
    if (this.motion.level() === 'reduced') return false;
    try { return this.document.defaultView?.sessionStorage.getItem(enteredKey) !== 'true'; }
    catch { return true; }
  }

  private remember() {
    try { this.document.defaultView?.sessionStorage.setItem(enteredKey, 'true'); }
    catch { /* The intro still works when storage is blocked. */ }
  }
}
