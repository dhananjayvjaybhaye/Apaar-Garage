import type { gsap } from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import { heroMotion } from './hero.config';

type ScrollTools = { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger };

export function playHeroEntrance(hero: HTMLElement, reduced: boolean) {
  const entrance = Array.from(hero.querySelectorAll<HTMLElement>('[data-hero-enter]'));
  const window = hero.querySelector<HTMLElement>('[data-hero-window]');
  if (!window?.animate) return () => undefined;
  if (reduced) {
    const fade = hero.animate([{ opacity: 0.75 }, { opacity: 1 }], {
      duration: heroMotion.reducedFade * 1000,
      easing: 'ease-out',
    });
    return () => fade.cancel();
  }

  const { entranceStagger: stagger, entrance: duration, sceneEntranceScale } = heroMotion;
  const animations = entrance.map((element, index) => {
    const masked = element.parentElement?.classList.contains('hero-title-line');
    return element.animate(
      [
        { transform: masked ? 'translateY(108%)' : 'translateY(12px)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      {
        duration: (duration - stagger * (entrance.length - 1)) * 1000,
        delay: index * stagger * 1000,
        fill: 'backwards',
        easing: 'cubic-bezier(.22,.73,.3,1)',
      },
    );
  });
  animations.push(
    window.animate(
      [
        { transform: 'scale(' + sceneEntranceScale + ')', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: duration * 700, delay: duration * 300, fill: 'backwards', easing: 'ease-out' },
    ),
  );
  const focus = () => animations.forEach((animation) => animation.cancel());
  // Show controls immediately if keyboard focus enters during the entrance.
  hero.addEventListener('focusin', focus, { once: true });
  return () => {
    hero.removeEventListener('focusin', focus);
    focus();
  };
}

export function attachHeroScroll(
  hero: HTMLElement,
  tools: ScrollTools,
  dolly: (progress: number) => void,
) {
  const nextHeading = hero.closest('main')?.querySelector('#garage-tour-title');

  const context = tools.gsap.context(() => {
    const {
      scrub,
      scrollDistance,
      copyLag,
      sceneLift,
      sceneScale,
      controlsFadeStart,
      controlsLiftPx,
      glowFadeEnd,
      featuredRiseStart,
      featuredLiftPx,
    } = heroMotion;
    const camera = { progress: 0 };
    const timeline = tools.gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: () => '+=' + Math.round(hero.offsetHeight * scrollDistance),
        scrub,
        invalidateOnRefresh: true,
      },
    });
    timeline
      .to(
        '[data-hero-copy]',
        { y: () => hero.offsetHeight * scrollDistance * copyLag, opacity: 0, duration: 1 },
        0,
      )
      .to(
        '[data-hero-visual]',
        { y: () => -hero.offsetHeight * sceneLift, scale: sceneScale, opacity: 0, duration: 1 },
        0,
      )
      .to('[data-hero-glow]', { opacity: 0, duration: glowFadeEnd }, 0)
      .to(camera, { progress: 1, duration: 1, onUpdate: () => dolly(camera.progress) }, 0)
      .to(
        '[data-hero-controls]',
        { y: -controlsLiftPx, opacity: 0, duration: 1 - controlsFadeStart },
        controlsFadeStart,
      );
    if (nextHeading) {
      timeline.fromTo(
        nextHeading,
        { y: featuredLiftPx },
        { y: 0, duration: 1 - featuredRiseStart },
        featuredRiseStart,
      );
    }
  }, hero);

  return () => {
    context.revert();
    dolly(0);
  };
}
