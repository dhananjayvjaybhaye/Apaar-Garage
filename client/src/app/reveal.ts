import { afterNextRender, DestroyRef, Directive, effect, ElementRef, inject, input, numberAttribute } from '@angular/core';
import { Motion } from './motion/motion';

@Directive({ selector: '[appReveal]' })
export class Reveal {
  readonly index = input(0, { alias: 'appReveal', transform: (value: unknown) => numberAttribute(value, 0) });
  readonly gentle = input(false, { alias: 'gentleReveal' });

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const motion = inject(Motion);
    const destroy = inject(DestroyRef);
    let animation: Animation | undefined;
    let previousLevel = motion.level();
    effect(() => {
      const nextLevel = motion.level();
      if (nextLevel !== previousLevel) animation?.cancel();
      previousLevel = nextLevel;
    });
    afterNextRender(() => motion.zone.runOutsideAngular(() => {
      const stop = motion.revealWhenVisible(element, () => {
        if (!element.animate || element.matches(':focus-within')) return;
        const full = motion.level() === 'full' && !this.gentle();
        const start: Keyframe = full
          ? { opacity: 0.35, transform: 'perspective(850px) translate3d(0, 16px, -20px) rotateX(-8deg)' }
          : { opacity: 0.7 };
        const end: Keyframe = full ? { opacity: 1, transform: 'none' } : { opacity: 1 };
        animation = element.animate([start, end], {
          duration: full ? 400 : 180,
          delay: full ? Math.max(0, Math.min(this.index(), 6)) * 38 : 0,
          easing: 'cubic-bezier(.2,.7,.25,1)',
          fill: 'backwards',
        });
      });
      const focus = () => animation?.cancel();
      element.addEventListener('focusin', focus);
      destroy.onDestroy(() => { stop(); focus(); element.removeEventListener('focusin', focus); });
    }));
  }
}
