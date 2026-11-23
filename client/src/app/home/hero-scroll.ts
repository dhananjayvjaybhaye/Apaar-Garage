import { isDevMode } from '@angular/core';
import { heroSteps } from './hero.config';
import { createHeroStepper, lastHeroZone, stepForKey, wheelPixels } from './hero-gesture';

const historyKey = 'garageHeroZone';
const dialog =
  'dialog[open], [role="dialog"][aria-modal="true"]:not(dialog, [hidden], [aria-hidden="true"])';
const editable =
  'input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])';

export function savedHeroZone(view: Window) {
  const index: unknown = view.history.state?.[historyKey];
  return !view.location.hash &&
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index <= lastHeroZone
    ? index
    : undefined;
}

export function heroPosition(hero: HTMLElement, view: Window, headerHeight: number) {
  const document = hero.ownerDocument;
  const rect = hero.getBoundingClientRect();
  const nav = document.querySelector('app-mobile-nav nav')?.getBoundingClientRect().height ?? 0;
  const inset = Math.min(headerHeight, view.innerHeight - nav - rect.height);
  return {
    offset: view.scrollY - Math.max(0, view.scrollY + rect.top - inset),
    end: view.scrollY + rect.bottom - headerHeight,
    visible: rect.bottom > headerHeight && rect.top < view.innerHeight - nav,
  };
}

interface HeroInputOptions {
  hero: HTMLElement;
  headerHeight: () => number;
  index: () => number;
  move: (index: number, done: () => void) => void;
  seek: (index: number) => void;
  fail: () => void;
}

export function attachHeroInput(options: HeroInputOptions) {
  const { hero, headerHeight, index, move, seek } = options;
  const document = hero.ownerDocument;
  const view = document.defaultView!;
  const listeners = new AbortController();
  const { signal } = listeners;
  const tolerance = heroSteps.anchorTolerancePx;
  const path = view.location.pathname;
  const entry = view.history.state?.navigationId;
  let exit: -1 | 1 | undefined;
  let settle: number | undefined;

  const position = () => heroPosition(hero, view, headerHeight());

  function release(direction: -1 | 1) {
    exit = direction;
    if (settle !== undefined) view.clearTimeout(settle);
    // Release toward the real content. No virtual scroll height is inserted for the benches.
    view.scrollTo({ top: direction < 0 ? 0 : position().end + tolerance + 1, behavior: 'smooth' });
    settle = view.setTimeout(() => {
      exit = undefined;
    }, heroSteps.moveMs);
  }
  function disable() {
    stepper.disable();
    listeners.abort();
    if (settle !== undefined) view.clearTimeout(settle);
  }
  const stepper = createHeroStepper({
    index,
    move,
    release,
    now: () => view.performance.now(),
    fail: () => {
      disable();
      options.fail();
    },
  });

  let cameFromBelow = position().offset > tolerance;
  function trackPosition() {
    const { offset } = position();
    if (offset > tolerance) cameFromBelow = true;
    if (offset < -tolerance) cameFromBelow = false;
    if (Math.abs(offset) <= tolerance && cameFromBelow && exit !== 1) {
      cameFromBelow = false;
      seek(lastHeroZone);
    }
    if ((exit === 1 && offset > tolerance) || (exit === -1 && offset < -tolerance))
      exit = undefined;
  }

  function intercept(direction: -1 | 1, fromPointer = false, wheelDelta = 0) {
    const { offset, visible } = position();
    if (exit === direction) return false;
    if (exit) exit = undefined;
    if (Math.abs(offset) <= tolerance && visible) return stepper.step(direction);
    const approachingFromBelow = offset > tolerance && direction < 0;
    const approachingFromAbove = offset < -tolerance && direction > 0;
    if (!approachingFromBelow && !approachingFromAbove) return false;
    if (!visible && Math.abs(wheelDelta) < Math.abs(offset)) return false;
    if (fromPointer && !visible) return false;
    cameFromBelow = false;
    seek(approachingFromBelow ? lastHeroZone : 0);
    view.scrollTo({ top: view.scrollY - offset, behavior: 'instant' });
    return true;
  }

  function remember() {
    if (view.location.hash || view.location.pathname !== path) return;
    const state = view.history.state;
    if (state?.navigationId !== entry) return;
    if (Math.abs(position().offset) <= tolerance) {
      if (state?.[historyKey] !== index())
        view.history.replaceState({ ...state, [historyKey]: index() }, '');
    } else if (state?.[historyKey] !== undefined) {
      const { [historyKey]: _zone, ...rest } = state;
      view.history.replaceState(rest, '');
    }
  }

  const modalOpen = () => !!document.querySelector(dialog);
  const debugScroll =
    isDevMode() && new URLSearchParams(view.location.search).get('debugScroll') === '1';
  hero.addEventListener(
    'wheel',
    (event) => {
      if (debugScroll) {
        const { deltaY, deltaX, deltaMode, ctrlKey, timeStamp } = event;
        console.debug('Garage wheel', { deltaY, deltaX, deltaMode, ctrlKey, timeStamp });
      }
      if (event.defaultPrevented || modalOpen()) return;
      if (event.target instanceof Element && event.target.closest(editable)) return;
      const delta = wheelPixels(event, view.innerHeight);
      if (delta === undefined) return;
      const { offset, visible } = position();
      const block = visible && Math.abs(offset) <= tolerance && exit !== Math.sign(delta);
      let captured = false;
      const enabled = stepper.wheel(
        delta,
        (direction) => (captured = intercept(direction, false, delta)),
      );
      if (enabled && event.cancelable && (captured || block)) event.preventDefault();
    },
    { passive: false, signal },
  );
  view.addEventListener(
    'keydown',
    (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || modalOpen())
        return;
      const target = event.target as Element | null;
      if (
        target?.closest?.(editable) ||
        (target && target !== document.body && !hero.contains(target))
      )
        return;
      if (event.key === ' ' && target?.closest?.('a, button, [role="button"]')) return;
      const command = stepForKey(event.key, event.shiftKey);
      if (command === undefined) return;
      const { offset, visible } = position();
      if (!visible || (Math.abs(offset) > tolerance && typeof command !== 'number')) return;
      if (event.repeat) {
        if (Math.abs(offset) <= tolerance) event.preventDefault();
        return;
      }
      if (typeof command === 'number') {
        if (!intercept(command)) return;
      } else {
        stepper.select(command === 'first' ? 0 : lastHeroZone);
      }
      event.preventDefault();
    },
    { signal },
  );
  view.addEventListener('scroll', trackPosition, { passive: true, signal });
  document.addEventListener('scrollend', remember, { signal });
  view.addEventListener('pagehide', remember, { signal });
  view.addEventListener(
    'pageshow',
    (event) => {
      if (event.persisted) {
        const restored = savedHeroZone(view);
        if (restored !== undefined) seek(restored);
      }
    },
    { signal },
  );

  return {
    swipe: (direction: -1 | 1) => !modalOpen() && intercept(direction, true),
    remember,
    destroy: disable,
  };
}
