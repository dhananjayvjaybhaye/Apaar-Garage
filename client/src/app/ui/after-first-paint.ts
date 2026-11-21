import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, inject, Injectable, signal } from '@angular/core';

// Leave the browser a short window to paint and respond before starting optional work.
const paintGraceMs = 900;
// Maximum wait for an idle slot after the first paint grace period, in milliseconds.
const idleDeadlineMs = 1200;

@Injectable({ providedIn: 'root' })
export class AfterFirstPaint {
  private readonly started = signal(false);
  private readonly idleStarted = signal(false);
  readonly ready = this.started.asReadonly();
  readonly idle = this.idleStarted.asReadonly();

  constructor() {
    const view = inject(DOCUMENT).defaultView;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (!view?.requestAnimationFrame) {
        this.started.set(true);
        this.idleStarted.set(true);
        return;
      }
      let secondFrame = 0;
      let timer = 0;
      let idle = 0;
      const firstFrame = view.requestAnimationFrame(() => {
        secondFrame = view.requestAnimationFrame(() => {
          timer = view.setTimeout(() => {
            this.started.set(true);
            const beginDecorations = () => this.idleStarted.set(true);
            if (typeof view.requestIdleCallback === 'function') {
              idle = view.requestIdleCallback(beginDecorations, { timeout: idleDeadlineMs });
            } else beginDecorations();
          }, paintGraceMs);
        });
      });
      destroy.onDestroy(() => {
        view.cancelAnimationFrame(firstFrame);
        view.cancelAnimationFrame(secondFrame);
        view.clearTimeout(timer);
        if (idle) view.cancelIdleCallback(idle);
      });
    });
  }
}
