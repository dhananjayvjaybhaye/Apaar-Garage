import { heroSteps } from './hero.config';

export function createHeroTravel(
  view: Window,
  fail: () => void,
  changed?: (active: boolean) => void,
) {
  let frame = 0;
  let watchdog = 0;
  let running = false;

  function cancel() {
    view.cancelAnimationFrame(frame);
    view.clearTimeout(watchdog);
    if (running) {
      running = false;
      changed?.(false);
    }
  }

  function start(target: number, duration: number, complete?: () => void) {
    cancel();
    const origin = view.scrollY;
    if (Math.abs(target - origin) < heroSteps.settleTolerancePx) {
      complete?.();
      return;
    }
    let previous: number | undefined;
    let elapsed = 0;
    running = true;
    changed?.(true);
    watchdog = view.setTimeout(() => {
      cancel();
      fail();
    }, heroSteps.stallMs);

    function tick(time: number) {
      try {
        if (previous !== undefined)
          elapsed += Math.min(time - previous, heroSteps.maxTravelFrameMs);
        previous = time;
        const fraction = Math.max(0, Math.min(1, elapsed / duration));
        const eased = fraction * fraction * (3 - 2 * fraction);
        // Each frame owns its position, so the browser cannot add a second smooth scroll.
        view.scrollTo({ top: origin + (target - origin) * eased, behavior: 'instant' });
        if (fraction < 1) frame = view.requestAnimationFrame(tick);
        else {
          cancel();
          complete?.();
        }
      } catch {
        cancel();
        fail();
      }
    }

    frame = view.requestAnimationFrame(tick);
  }

  return { start, cancel, active: () => running };
}
