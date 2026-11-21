import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input, numberAttribute } from '@angular/core';
import { clamp } from './element-pointer';
import { Motion } from './motion';
import { AmbientViewport } from './ambient-viewport';

@Directive({ selector: '[appParallax]' })
export class Parallax {
  readonly depth = input(1, { alias: 'appParallax', transform: (value: unknown) => numberAttribute(value, 1) });

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const motion = inject(Motion);
    const viewport = inject(AmbientViewport);
    const destroy = inject(DestroyRef);
    afterNextRender(() => motion.zone.runOutsideAngular(() => {
      const base = element.parentElement ?? element;
      let unsubscribe: (() => void) | undefined;
      let lastTransform = '';
      const unobserve = viewport.observe(element, (visible) => {
        if (!visible) {
          unsubscribe?.();
          unsubscribe = undefined;
          element.style.removeProperty('transform');
          lastTransform = '';
          return;
        }
        unsubscribe ??= motion.subscribe(({ pointer, width, height }) => {
          if (motion.level() !== 'full') {
            if (lastTransform) element.style.removeProperty('transform');
            lastTransform = '';
            return;
          }
          if (!width || !height) return;
          const depth = clamp(this.depth());
          const rect = base.getBoundingClientRect();
          const scroll = clamp((height / 2 - (rect.top + rect.height / 2)) / height);
          const x = pointer ? clamp(pointer.x / width * 2 - 1) : 0;
          const y = pointer ? clamp(pointer.y / height * 2 - 1) : 0;
          const transform = 'translate3d(' + (x * depth * 14).toFixed(1) + 'px,' +
            ((y * 10 + scroll * 32) * depth).toFixed(1) + 'px, 0px)';
          if (lastTransform !== transform) {
            element.style.transform = transform;
            lastTransform = transform;
          }
        });
      });
      destroy.onDestroy(() => {
        unobserve();
        unsubscribe?.();
        element.style.removeProperty('transform');
      });
    }));
  }
}
