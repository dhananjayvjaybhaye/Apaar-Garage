import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, inject, Injectable, signal } from '@angular/core';

// Leave the browser a short window to paint and respond before starting optional work.
const paintGraceMs = 900;

@Injectable({ providedIn: 'root' })
export class AfterFirstPaint {
  private readonly started = signal(false);
  readonly ready = this.started.asReadonly();

  constructor() {
    const view = inject(DOCUMENT).defaultView;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (!view?.requestAnimationFrame) {
        this.started.set(true);
        return;
      }
      let secondFrame = 0;
      let timer = 0;
      const firstFrame = view.requestAnimationFrame(() => {
        secondFrame = view.requestAnimationFrame(() => {
          timer = view.setTimeout(() => this.started.set(true), paintGraceMs);
        });
      });
      destroy.onDestroy(() => {
        view.cancelAnimationFrame(firstFrame);
        view.cancelAnimationFrame(secondFrame);
        view.clearTimeout(timer);
      });
    });
  }
}
