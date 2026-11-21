import type { gsap } from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import { tourConfig } from './garage-tour.config';

type ScrollTools = { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger };

export function watchTour(
  course: HTMLElement,
  rail: HTMLElement,
  update: (index: number, engaged: boolean) => void,
  moveCamera: (progress: number) => void,
) {
  const view = course.ownerDocument.defaultView!;
  const header = course.ownerDocument.querySelector('app-store-header');
  const blocks = [...course.querySelectorAll<HTMLElement>('[data-tour-stop]')];
  const mobile = view.matchMedia('(max-width: ' + (tourConfig.desktopAtRem - 0.01) + 'rem)');
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const options = { passive: true, signal: events.signal };
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  let visible = false;
  let frame = 0;
  let stickyTop = 0;
  let courseStart = 0;
  let courseEnd = 0;
  let first = 0;
  let release = 0;
  let stops: number[] = [];
  let layoutDirty = true;
  let tools: ScrollTools | undefined;
  let tween: gsap.core.Tween | undefined;

  const start = () => Math.max(0, first - tourConfig.frameEnterPx);
  const end = () => Math.max(start() + 1, courseEnd - stickyTop);

  // On mobile the usable reading area starts below the viewer and its controls.
  const crossing = () =>
    mobile.matches
      ? Math.min(
          view.innerHeight - tourConfig.crossingClearancePx,
          Math.max(
            view.innerHeight / 2,
            stickyTop + rail.offsetHeight + tourConfig.crossingClearancePx,
          ),
        )
      : view.innerHeight / 2;

  function measure() {
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    stickyTop = headerHeight + tourConfig.stickyGapPx;
    course.style.setProperty('--tour-sticky-top', stickyTop + 'px');
    const y = view.scrollY;
    const bounds = course.getBoundingClientRect();
    courseStart = bounds.top + y;
    courseEnd = bounds.bottom + y;
    first = courseStart - stickyTop;
    release = Math.max(first, end() - rail.offsetHeight);
    const line = crossing();
    stops = [
      first,
      ...blocks.slice(1).map((block) => block.getBoundingClientRect().top + y - line),
    ];
  }

  function categoryAt(y: number) {
    let index = 0;
    while (index + 1 < stops.length && y >= stops[index + 1]) index++;
    return index;
  }

  function paint(y: number) {
    if (!visible || !stops.length || course.ownerDocument.hidden) return;
    const index = categoryAt(y);
    const from = stops[index];
    const to = stops[index + 1] ?? Math.max(end(), from + 1);
    const progress = (index + clamp((y - from) / Math.max(1, to - from))) / stops.length;
    moveCamera(progress);

    const arrival = 1 - clamp((y - start()) / Math.max(1, first - start()));
    const exit = clamp((y - release) / tourConfig.exitFadePx);
    const edge = Math.max(arrival, exit);
    rail.style.setProperty('--tour-opacity', String(1 - exit));
    rail.style.setProperty('--tour-scale', String(1 - edge * (1 - tourConfig.frameScale)));
    rail.style.setProperty('--tour-tilt', edge * tourConfig.frameTiltDegrees + 'deg');
    const offset = 0.5 - progress;
    rail.style.setProperty('--tour-glow-y', offset * tourConfig.glowTravelPx + 'px');
    rail.style.setProperty('--tour-beam-y', offset * tourConfig.beamTravelPx + 'px');
    rail.style.setProperty('--tour-dust-y', offset * tourConfig.dustTravelPx + 'px');
  }

  function draw() {
    if (layoutDirty) {
      layoutDirty = false;
      measure();
      tween?.scrollTrigger?.refresh();
    }
    const y = view.scrollY;
    update(categoryAt(y), y >= first - tourConfig.canvasLeadPx && y < end());
    if (!tween && !reduced.matches) paint(y);
  }

  const queue = () => {
    if (frame || !visible || course.ownerDocument.hidden) return;
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  };
  const size = () => {
    layoutDirty = true;
    queue();
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    rail.classList.toggle('atmosphere-running', visible && !course.ownerDocument.hidden);
    if (visible) size();
    else update(-1, false);
  });
  const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(size);
  if (header) resize?.observe(header);
  resize?.observe(rail);
  for (const block of blocks) resize?.observe(block);
  observer.observe(course);
  view.addEventListener('scroll', queue, options);
  view.addEventListener('resize', size, options);
  course.ownerDocument.addEventListener(
    'visibilitychange',
    () => {
      rail.classList.toggle('atmosphere-running', visible && !course.ownerDocument.hidden);
      queue();
    },
    options,
  );

  function syncMotion() {
    tween?.scrollTrigger?.kill();
    tween?.kill();
    tween = undefined;
    if (!tools || reduced.matches || events.signal.aborted) return;
    measure();
    const driver = { value: 0 };
    tween = tools.gsap.to(driver, {
      value: 1,
      duration: 1,
      ease: 'none',
      onUpdate: () => paint(start() + driver.value * (end() - start())),
      scrollTrigger: { start, end, scrub: tourConfig.scrubSeconds },
    });
  }
  reduced.addEventListener('change', syncMotion, options);

  return {
    animate(animation: ScrollTools) {
      tools = animation;
      syncMotion();
    },
    scrollTo(index: number) {
      if (!blocks[index]) return;
      if (layoutDirty || !stops.length) measure();
      view.scrollTo({
        top: Math.max(0, stops[index] + tourConfig.tabCrossingInsetPx),
        behavior: reduced.matches ? 'instant' : 'smooth',
      });
    },
    destroy() {
      events.abort();
      syncMotion();
      observer.disconnect();
      resize?.disconnect();
      if (frame) view.cancelAnimationFrame(frame);
    },
  };
}
