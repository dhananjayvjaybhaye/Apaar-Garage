import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { elementPointer } from './element-pointer';
import { Motion } from './motion';

@Directive({ selector: '[appMagnetic]' })
export class Magnetic {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const motion = inject(Motion);
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      element.classList.add('motion-magnetic');
      const stop = elementPointer(element, motion, (x, y) => {
        element.style.setProperty('--magnetic-x', (x * 5).toFixed(2) + 'px');
        element.style.setProperty('--magnetic-y', (y * 4).toFixed(2) + 'px');
      }, () => {
        element.style.removeProperty('--magnetic-x');
        element.style.removeProperty('--magnetic-y');
      });
      destroy.onDestroy(stop);
    });
  }
}
