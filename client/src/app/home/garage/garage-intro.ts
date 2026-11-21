import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  isDevMode,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Motion } from '../../motion/motion';
import { GarageSound } from '../../ui/garage-sound';
import { animateGarageDoor, garageIntro } from './garage-intro-motion';

const enteredKey = 'apaar-garage-entered';

@Component({
  selector: 'app-garage-intro',
  templateUrl: './garage-intro.html',
  styleUrl: './garage-intro.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarageIntro {
  readonly closed = output<boolean>();
  private readonly motion = inject(Motion);
  private readonly document = inject(DOCUMENT);
  private readonly sound = inject(GarageSound);
  private readonly modal = viewChild<ElementRef<HTMLDialogElement>>('modal');
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');
  private cancelAnimation?: () => void;
  private timeout?: ReturnType<typeof setTimeout>;
  private alive = true;

  protected readonly visible = signal(this.shouldShow());
  protected readonly opening = signal(false);
  protected readonly slats = Array.from({ length: garageIntro.panels }, (_, index) => index);

  constructor() {
    afterNextRender(() => {
      const dialog = this.modal()?.nativeElement;
      if (!dialog || !this.visible()) return;
      this.armFailsafe();
      try {
        dialog.showModal();
        this.document.documentElement.classList.add('garage-intro-open');
      } catch {
        this.finish();
      }
    });
    effect(() => {
      if (this.visible() && this.motion.level() === 'reduced') this.finish();
    });
    inject(DestroyRef).onDestroy(() => {
      this.alive = false;
      this.release();
    });
  }

  protected enter() {
    const dialog = this.modal()?.nativeElement;
    if (this.opening() || !dialog?.open) return;
    this.opening.set(true);
    this.title()?.nativeElement.focus({ preventScroll: true });
    this.armFailsafe();
    this.sound.prepareIntro();
    try {
      this.cancelAnimation = this.motion.zone.runOutsideAngular(() =>
        animateGarageDoor(dialog, {
          unlock: () => this.sound.click(),
          open: () => this.sound.enter(),
          finish: () => this.motion.zone.run(() => this.finish(true)),
        }),
      );
    } catch {
      this.finish();
    }
  }

  protected dismiss(event: Event) {
    event.preventDefault();
    this.finish();
  }

  private armFailsafe() {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.finish(), garageIntro.failsafeMs);
  }

  private release() {
    clearTimeout(this.timeout);
    this.cancelAnimation?.();
    const dialog = this.modal()?.nativeElement;
    if (dialog?.open) dialog.close();
    this.document.documentElement.classList.remove('garage-intro-open');
  }

  private finish(animated = false) {
    if (!this.alive || !this.visible()) return;
    this.release();
    if (!animated && this.opening()) this.sound.stopIntro();
    this.visible.set(false);
    try {
      this.document.defaultView?.sessionStorage.setItem(enteredKey, 'true');
    } catch {
      /* The intro still opens when storage is blocked. */
    }
    this.closed.emit(animated);
  }

  private shouldShow() {
    const view = this.document.defaultView;
    if (!view || this.motion.level() === 'reduced') return false;
    if (isDevMode() && new URLSearchParams(view.location.search).get('intro') === '1') return true;
    try {
      return view.sessionStorage.getItem(enteredKey) !== 'true';
    } catch {
      return true;
    }
  }
}
