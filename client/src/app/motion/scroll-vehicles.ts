import { afterNextRender, DestroyRef, Directive, ElementRef, inject, NgZone } from '@angular/core';
import { AmbientViewport } from './ambient-viewport';
import { mediaQuery } from '../ui/media-query';
import { motionQueries } from './motion-policy';

const trackMotion = {
  startAt: 0.9, // The track starts moving when its top reaches 90% of the viewport.
  finishAt: 0.18,
  maxLiftPx: 54,
  aircraftClearancePx: 14,
  maxClimbDegrees: 10,
} as const;

@Directive({ selector: '[appScrollVehicles]' })
export class ScrollVehicles {
  constructor() {
    const stage = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const zone = inject(NgZone);
    const viewport = inject(AmbientViewport);
    const lifetime = inject(DestroyRef);
    afterNextRender(() => {
      const car = stage.querySelector<HTMLElement>('[data-pit-car]');
      const plane = stage.querySelector<HTMLElement>('[data-pit-plane]');
      const view = stage.ownerDocument.defaultView;
      if (!view || !car || !plane) return;

      const reduced = mediaQuery(motionQueries[0], view);
      let visible = false;
      let scrollEvents: AbortController | undefined;
      let frame = 0;

      const updatePosition = () => {
        if (!visible || reduced?.matches) return;
        const { top, width } = stage.getBoundingClientRect();
        const { innerHeight } = view;
        const distance = innerHeight * (trackMotion.startAt - trackMotion.finishAt);
        if (!distance || !width) return;
        const progress = Math.max(
          0,
          Math.min(1, (innerHeight * trackMotion.startAt - top) / distance),
        );
        const carTravel = Math.max(0, width - car.offsetWidth - 2 * car.offsetLeft);
        const planeTravel = Math.max(0, width - plane.offsetWidth - 2 * plane.offsetLeft);
        const headroom = Math.max(0, plane.offsetTop - trackMotion.aircraftClearancePx);
        const arc = Math.sin(Math.PI * progress);
        const lift = arc * Math.min(headroom, trackMotion.maxLiftPx);

        car.style.transform = `translate3d(${(carTravel * progress).toFixed(1)}px, 0, 0)`;
        plane.style.transform = `translate3d(${(planeTravel * progress).toFixed(1)}px, ${(-lift).toFixed(1)}px, 0) rotate(${(-trackMotion.maxClimbDegrees * arc).toFixed(1)}deg)`;
      };

      const queue = () => {
        if (frame) return;
        frame = view.requestAnimationFrame(() => {
          frame = 0;
          updatePosition();
        });
      };
      const pause = () => {
        scrollEvents?.abort();
        scrollEvents = undefined;
        view.cancelAnimationFrame(frame);
        frame = 0;
      };
      const sync = () => {
        if (reduced?.matches) {
          pause();
          stage.classList.remove('scroll-positioned');
          car.style.removeProperty('transform');
          plane.style.removeProperty('transform');
          return;
        }
        if (!visible || scrollEvents) return;

        scrollEvents = new AbortController();
        const options = { passive: true, signal: scrollEvents.signal };
        stage.classList.add('scroll-positioned');
        view.addEventListener('scroll', queue, options);
        view.addEventListener('resize', queue, options);
        queue();
      };

      const unobserve = viewport.observe(stage, (shown) => {
        visible = shown;
        if (shown) sync();
        else pause();
      });
      zone.runOutsideAngular(() => reduced?.addEventListener('change', sync));
      lifetime.onDestroy(() => {
        unobserve();
        pause();
        reduced?.removeEventListener('change', sync);
      });
    });
  }
}
