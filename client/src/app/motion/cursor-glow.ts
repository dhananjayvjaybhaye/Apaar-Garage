import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { Motion } from './motion';

@Component({
  selector: 'app-cursor-glow',
  template: '<span class="cursor-core"><span>View</span></span>',
  host: { 'aria-hidden': 'true' },
  styleUrl: './cursor-glow.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CursorGlow {
  constructor() {
    const motion = inject(Motion);
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      destroy.onDestroy(motion.subscribe(({ pointer }) => {
        const target = pointer?.target;
        const show = pointer && motion.level() === 'full' &&
          !target?.closest('input,textarea,select,dialog,.media-stack canvas,app-home-hero') &&
          !element.ownerDocument.querySelector('dialog[open]');
        element.classList.toggle('cursor-visible', Boolean(show));
        if (!show) return;
        element.style.transform = 'translate3d(' + pointer.x + 'px,' + pointer.y + 'px,0)';
        const clickable = target?.closest('a[href],button,summary,[role=button]');
        element.classList.toggle('cursor-action', Boolean(clickable && !clickable.matches(':disabled,[aria-disabled=true]')));
        element.classList.toggle('cursor-product', Boolean(target?.closest('.product-photo')));
      }));
    });
  }
}
