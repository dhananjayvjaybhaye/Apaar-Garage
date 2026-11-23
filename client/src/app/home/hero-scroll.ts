import { isDevMode } from '@angular/core';
import { heroSteps, heroTransfer } from './hero.config';
import { createHeroStepper, lastHeroZone, stepForKey, wheelPixels } from './hero-gesture';
import { createHeroTravel } from './hero-travel';

import { heroZoneHistoryKey as historyKey } from './hero-history';
const dialog =
  'dialog[open], [role="dialog"][aria-modal="true"]:not(dialog, [hidden], [aria-hidden="true"])';
const editable =
  'input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])';
const interactive = 'a, button, summary, [role="button"], [role="link"], ' + editable;

export function savedHeroZone(view: Window) {
  let index: unknown = view.history.state?.[historyKey];
  if (
    index === undefined &&
    (view.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
      ?.type === 'reload'
  ) {
    try {
      const stored = view.sessionStorage.getItem(historyKey);
      if (stored !== null) index = Number(stored);
    } catch {
      // No zone was restored in this browser.
    }
  }
  return !view.location.hash &&
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index <= lastHeroZone
    ? index
    : undefined;
}

export function heroPosition(hero: HTMLElement, view: Window, headerHeight: number) {
  const rect = hero.getBoundingClientRect();
  const nav =
    hero.ownerDocument.querySelector('app-mobile-nav nav')?.getBoundingClientRect().height ?? 0;
  const inset = Math.min(headerHeight, view.innerHeight - nav - rect.height);
  const anchor = Math.max(0, view.scrollY + rect.top - inset);
  return {
    anchor,
    offset: view.scrollY - anchor,
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
  const path = view.location.pathname;
  const entry = view.history.state?.navigationId;
  const position = () => heroPosition(hero, view, headerHeight());
  const nearAnchor = (offset: number) => Math.abs(offset) <= heroSteps.anchorTolerancePx;
  const modalOpen = () => !!document.querySelector(dialog);
  const now = () => view.performance.now();
  const travel = createHeroTravel(view, fail, (active) => {
    hero.toggleAttribute(heroTransfer.attribute, active);
    hero.dispatchEvent(new Event(heroTransfer.event));
  });
  let lastTransferWheel = -Infinity;
  let lastApproachWheel = -Infinity;
  let cameFromBelow = view.scrollY >= position().end;

  function fail() {
    destroy();
    options.fail();
  }
  const stepper = createHeroStepper({
    index,
    move,
    now,
    fail,
    release: (direction) => {
      lastTransferWheel = now();
      const target = direction < 0 ? 0 : position().end + heroSteps.settleTolerancePx;
      travel.start(target, heroSteps.transferMs);
    },
  });

  function returnToGarage() {
    cameFromBelow = false;
    lastTransferWheel = now();
    seek(lastHeroZone);
    travel.start(position().anchor, heroSteps.transferMs);
  }

  function trackPosition() {
    const { end, offset } = position();
    if (view.scrollY >= end - heroSteps.settleTolerancePx) cameFromBelow = true;
    if (travel.active() || !cameFromBelow) return;
    if (view.scrollY < end && now() - lastApproachWheel < heroSteps.wheelQuietMs) {
      returnToGarage();
    } else if (nearAnchor(offset)) {
      cameFromBelow = false;
      seek(lastHeroZone);
    }
  }

  function atAnchor(action: () => boolean) {
    const { anchor, offset, visible } = position();
    if (!visible || !nearAnchor(offset)) return false;
    if (travel.active()) return true;
    if (Math.abs(offset) < heroSteps.settleTolerancePx) return action();
    travel.start(anchor, heroSteps.alignMs, () => action());
    return true;
  }

  function remember() {
    if (view.location.hash || view.location.pathname !== path) return;
    const state = view.history.state;
    if (state?.navigationId !== entry) return;
    if (state?.[historyKey] !== index())
      view.history.replaceState({ ...state, [historyKey]: index() }, '');
  }

  const debugScroll =
    isDevMode() && new URLSearchParams(view.location.search).get('debugScroll') === '1';
  // The listener must see a wheel crossing the hero boundary and momentum after the target changes.
  // Away from that boundary or the active hero, the browser owns scrolling.
  view.addEventListener(
    'wheel',
    (event) => {
      const inside = event.composedPath().includes(hero);
      if (debugScroll && inside) {
        const { deltaY, deltaX, deltaMode, ctrlKey, timeStamp } = event;
        console.debug('Garage wheel', { deltaY, deltaX, deltaMode, ctrlKey, timeStamp });
      }
      if (event.defaultPrevented || modalOpen()) return;
      if (event.target instanceof Element && event.target.closest(editable)) return;
      const delta = wheelPixels(event, view.innerHeight);
      if (delta === undefined) return;
      const time = now();
      if (travel.active() || time - lastTransferWheel < heroSteps.wheelQuietMs) {
        lastTransferWheel = time;
        if (event.cancelable) event.preventDefault();
        return;
      }
      const { end, offset, visible } = position();
      if (delta < 0 && offset > heroSteps.anchorTolerancePx && cameFromBelow) {
        lastApproachWheel = time;
        if (view.scrollY + delta <= end && event.cancelable) {
          event.preventDefault();
          returnToGarage();
        }
        return;
      }
      if (!inside || !visible || !nearAnchor(offset)) return;
      if (
        stepper.wheel(delta, (direction) => atAnchor(() => stepper.step(direction))) &&
        event.cancelable
      )
        event.preventDefault();
    },
    { passive: false, signal },
  );

  view.addEventListener(
    'keydown',
    (event) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        modalOpen()
      )
        return;
      const target = event.target as Element | null;
      if (
        target?.closest?.(interactive) ||
        (target && target !== document.body && !hero.contains(target))
      )
        return;
      const command = stepForKey(event.key);
      if (command === undefined) return;
      const { offset, visible } = position();
      if (!visible || !nearAnchor(offset)) return;
      if (!event.repeat) {
        atAnchor(() =>
          typeof command === 'number'
            ? stepper.step(command)
            : stepper.select(command === 'first' ? 0 : lastHeroZone),
        );
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

  function destroy() {
    stepper.disable();
    travel.cancel();
    listeners.abort();
  }

  return {
    swipe: (direction: -1 | 1) => !modalOpen() && atAnchor(() => stepper.step(direction)),
    cancelTravel() {
      travel.cancel();
      lastTransferWheel = -Infinity;
      lastApproachWheel = -Infinity;
    },
    remember,
    destroy,
  };
}
