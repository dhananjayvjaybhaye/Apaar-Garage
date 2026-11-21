import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, inject, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StoreHeaderSize {
  private readonly measured = signal(0);
  readonly height = this.measured.asReadonly();

  constructor() {
    const document = inject(DOCUMENT);
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const header = document.querySelector('app-store-header');
      if (!header || typeof ResizeObserver === 'undefined') return;
      const size = new ResizeObserver(([entry]) => {
        // Reuse the browser's measurement instead of forcing layout during Angular rendering.
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (!height || this.measured() === height) return;
        document.documentElement.style.setProperty('--store-header-height', height + 'px');
        this.measured.set(height);
      });
      size.observe(header, { box: 'border-box' });
      destroy.onDestroy(() => {
        size.disconnect();
        document.documentElement.style.removeProperty('--store-header-height');
      });
    });
  }
}
