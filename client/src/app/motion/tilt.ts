import { afterNextRender, DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';
import { elementPointer } from './element-pointer';
import { Motion } from './motion';

@Directive({ selector: '[appTilt]' })
export class Tilt {
  readonly intensity = input(10, { alias: 'tiltDegrees' });

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const motion = inject(Motion);
    const destroy = inject(DestroyRef);
    const reset = () => {
      element.classList.remove('tilt-active');
      element.style.removeProperty('--tilt-x');
      element.style.removeProperty('--tilt-y');
      element.style.removeProperty('--glare-x');
      element.style.removeProperty('--glare-y');
    };
    afterNextRender(() => {
      element.classList.add('motion-tilt');
      const glare = element.ownerDocument.createElement('span');
      glare.className = 'motion-glare';
      glare.setAttribute('aria-hidden', 'true');
      element.append(glare);
      const stop = elementPointer(element, motion, (x, y) => {
        const max = Math.max(0, Math.min(10, this.intensity()));
        element.style.setProperty('--tilt-x', (-y * max).toFixed(2) + 'deg');
        element.style.setProperty('--tilt-y', (x * max).toFixed(2) + 'deg');
        element.style.setProperty('--glare-x', (x * 34).toFixed(1) + '%');
        element.style.setProperty('--glare-y', (y * 34).toFixed(1) + '%');
        element.classList.add('tilt-active');
      }, reset);
      destroy.onDestroy(() => { stop(); glare.remove(); });
    });
    effect(() => { if (motion.level() !== 'full') reset(); });
  }
}
