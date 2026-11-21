import type { gsap } from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import { heroMotion } from './hero.config';

type ScrollTools = { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger };

export function playHeroEntrance(hero: HTMLElement, reduced: boolean) {
  const items = [...hero.querySelectorAll<HTMLElement>('[data-hero-enter]')];
  const duration = heroMotion.entrance * 1000;
  const animations = reduced
    ? [
        hero.animate([{ opacity: 0.85 }, { opacity: 1 }], {
          duration: heroMotion.reducedFade * 1000,
        }),
      ]
    : items.map((element, index) =>
        element.animate(
          [
            {
              transform: element.closest('.hero-title-line')
                ? 'translateY(105%)'
                : 'translateY(14px)',
              opacity: 0,
            },
            { transform: 'none', opacity: 1 },
          ],
          {
            duration: duration - (items.length - 1) * heroMotion.entranceStagger * 1000,
            delay: index * heroMotion.entranceStagger * 1000,
            fill: 'backwards',
            easing: 'ease-out',
          },
        ),
      );
  const cancel = () => animations.forEach((animation) => animation.cancel());
  hero.addEventListener('focusin', cancel, { once: true });
  return () => {
    hero.removeEventListener('focusin', cancel);
    cancel();
  };
}

export function attachHeroScroll(
  hero: HTMLElement,
  { gsap, ScrollTrigger }: ScrollTools,
  headerHeight: () => number,
  update: (progress: number) => void,
) {
  const playhead = { progress: 0 };
  const view = hero.ownerDocument.defaultView!;
  let trigger: ScrollTrigger | undefined;
  const context = gsap.context(() => {
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: () => {
          const mobileNav = view.document.querySelector('app-mobile-nav nav');
          const bottom = view.innerHeight - (mobileNav?.getBoundingClientRect().height ?? 0);
          return 'top ' + Math.min(headerHeight(), bottom - hero.offsetHeight) + 'px';
        },
        end: () => '+=' + Math.round(view.innerHeight * heroMotion.scrollDistance),
        pin: true,
        scrub: heroMotion.scrub,
        invalidateOnRefresh: true,
      },
    });
    timeline.to(
      playhead,
      { progress: 1, duration: 1, ease: 'none', onUpdate: () => update(playhead.progress) },
      0,
    );
    timeline.to(
      '[data-hero-content]',
      {
        opacity: 0,
        y: -heroMotion.exitLiftPx,
        duration: 1 - heroMotion.exitStart,
        ease: 'none',
      },
      heroMotion.exitStart,
    );
    trigger = timeline.scrollTrigger;
  }, hero);
  return {
    refresh: () => ScrollTrigger.refresh(),
    jump(progress: number) {
      if (!trigger) return;
      view.scrollTo({
        top: trigger.start + (trigger.end - trigger.start) * progress,
        behavior: 'smooth',
      });
    },
    destroy: () => context.revert(),
  };
}
