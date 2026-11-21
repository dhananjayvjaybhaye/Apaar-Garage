import { mediaQuery } from '../ui/media-query';
import type { gsap } from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import { categoryScenes as config } from './category-scenes.config';

type Animator = typeof gsap;
type ScrollTools = { gsap: Animator; ScrollTrigger: typeof ScrollTrigger };
type MotionOptions = { mobile: boolean; reduced: boolean };

const sections = (listing: HTMLElement) =>
  Array.from(listing.querySelectorAll<HTMLElement>('.category-scene'));

export function animateCategoryScenes(listing: HTMLElement, { gsap, ScrollTrigger }: ScrollTools) {
  const view = listing.ownerDocument.defaultView!;
  if (!mediaQuery('all', view)) return () => undefined;
  const media = gsap.matchMedia(listing);
  media.add(
    {
      phone: '(width < 40rem)',
      tablet: '(40rem <= width < 64rem)',
      desktop: '(min-width: 64rem)',
      reduce: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      const motion = {
        mobile: Boolean(context.conditions?.['phone']),
        reduced: Boolean(context.conditions?.['reduce']),
      };
      sections(listing).forEach((section, index) => {
        animateHeading(gsap, section, motion.reduced);
        animateRows(gsap, section, view, motion);
        if (!motion.reduced) animateBackdrop(gsap, section, index, motion.mobile);
      });
      // Clean up promotion hints even if the route changes midway through a scrub.
      return () =>
        listing
          .querySelectorAll('.is-moving')
          .forEach((node) => node.classList.remove('is-moving'));
    },
  );
  ScrollTrigger.refresh();
  return () => media.revert();
}

function animateHeading(gsap: Animator, section: HTMLElement, reduced: boolean) {
  if (reduced) return;
  const heading = section.querySelector('[data-scene-heading]')!;
  const lines = heading.querySelectorAll('[data-heading-line]');
  const link = heading.querySelector('[data-heading-link]');
  gsap
    .timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: config.headingStart,
        end: config.headingEnd,
        scrub: config.scrubSeconds,
      },
    })
    .fromTo(
      lines,
      { xPercent: config.headingTravelPercent },
      { xPercent: 0, stagger: config.headingStagger, duration: config.headingLineDuration },
    )
    .fromTo(
      link,
      { opacity: 0 },
      { opacity: 1, duration: 1 - config.headingLinkAt },
      config.headingLinkAt,
    );
}

function animateRows(gsap: Animator, section: HTMLElement, view: Window, motion: MotionOptions) {
  const grid = section.querySelector<HTMLElement>('[data-scene-grid]');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-scene-card]'));
  const columns = Number(view.getComputedStyle(grid).getPropertyValue('--scene-columns')) || 1;
  for (let index = 0; index < cards.length; index += columns) {
    animateRow(gsap, cards.slice(index, index + columns), index / columns, motion);
  }
}

function animateRow(
  gsap: Animator,
  cards: HTMLElement[],
  row: number,
  { mobile, reduced }: MotionOptions,
) {
  const trigger = cards[0];
  const moving = cards.map((card) => card.querySelector('.scene-card-motion'));
  if (reduced) {
    gsap.fromTo(
      moving,
      { opacity: 0.65 },
      {
        opacity: 1,
        duration: config.reducedFadeSeconds,
        stagger: config.rowStagger,
        scrollTrigger: { trigger, start: config.rowStart, once: true },
      },
    );
    return;
  }
  const entry = mobile ? config.mobileEntry : config.entry;
  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger,
      start: config.rowStart,
      end: mobile ? config.mobileRowEnd : config.rowEnd,
      scrub: config.scrubSeconds,
      onToggle: ({ isActive }) =>
        cards.forEach((card) => card.classList.toggle('is-moving', isActive)),
    },
  });
  timeline.fromTo(
    moving,
    { y: entry.y, z: entry.z, rotateX: entry.rotationX, scale: entry.scale, opacity: 0 },
    {
      y: 0,
      z: 0,
      rotateX: 0,
      scale: 1,
      opacity: 1,
      duration: config.revealDuration,
      stagger: config.rowStagger,
    },
    0,
  );
  if (!mobile) {
    const softness = cards.flatMap((card) => Array.from(card.querySelectorAll('.card-softness')));
    if (softness.length)
      timeline.fromTo(
        softness,
        { opacity: 0.42 },
        { opacity: 0, duration: config.revealDuration, stagger: config.rowStagger },
        0,
      );
  }
  timeline.to(
    moving,
    {
      ...config.exit,
      y: config.exit.y - Math.min(row, 3) * config.rowParallaxPx,
      z: mobile ? 0 : config.exit.z,
      duration: 1 - config.leaveAt,
    },
    config.leaveAt,
  );
}

function animateBackdrop(gsap: Animator, section: HTMLElement, index: number, mobile: boolean) {
  const backdrop = section.querySelector<HTMLElement>('.scene-backdrop')!;
  const layers = backdrop.querySelectorAll('span');
  const travels = Object.values(config.atmosphereTravelPx);
  gsap
    .timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: config.scrubSeconds,
        onToggle: ({ isActive }) => backdrop.classList.toggle('is-moving', isActive),
      },
    })
    .fromTo(
      backdrop,
      { y: index ? config.overlapTravelPx : 0, opacity: index ? 0.35 : 1 },
      { y: 0, opacity: 1, duration: config.overlapDuration },
      0,
    )
    .fromTo(
      layers,
      { y: (layer: number) => travels[layer] * (mobile ? 0.25 : 0.5) },
      {
        y: (layer: number) => -travels[layer] * (mobile ? 0.25 : 0.5),
        duration: 1,
      },
      0,
    );
}
