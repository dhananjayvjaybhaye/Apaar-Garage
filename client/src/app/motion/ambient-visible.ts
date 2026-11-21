import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { AmbientViewport } from './ambient-viewport';

@Directive({ selector: '[appAmbientVisible]' })
export class AmbientVisible {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const viewport = inject(AmbientViewport);
    const lifetime = inject(DestroyRef);
    afterNextRender(() => {
      const unobserve = viewport.observe(element, (visible) => element.classList.toggle('ambient-in-view', visible));
      lifetime.onDestroy(unobserve);
    });
  }
}
