import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AmbientViewport {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly entries = new Map<Element, { intersecting: boolean; update: (visible: boolean) => void }>();
  private observer?: IntersectionObserver;

  constructor() {
    this.zone.runOutsideAngular(() => this.document.addEventListener('visibilitychange', this.visibility));
    inject(DestroyRef).onDestroy(() => {
      this.observer?.disconnect();
      this.entries.clear();
      this.document.removeEventListener('visibilitychange', this.visibility);
    });
  }

  observe(element: Element, update: (visible: boolean) => void) {
    this.zone.runOutsideAngular(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      this.observer ??= new IntersectionObserver((changes) => {
        for (const { target, isIntersecting } of changes) {
          const entry = this.entries.get(target);
          if (!entry) continue;
          entry.intersecting = isIntersecting;
          entry.update(isIntersecting && !this.document.hidden);
        }
      });
      this.entries.set(element, { update, intersecting: false });
      this.observer.observe(element);
    });
    return () => {
      this.entries.delete(element);
      this.observer?.unobserve(element);
    };
  }

  private readonly visibility = () => {
    for (const entry of this.entries.values()) entry.update(entry.intersecting && !this.document.hidden);
  };
}
