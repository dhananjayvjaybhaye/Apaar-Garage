export const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function mediaQuery(
  query: string,
  view: Window | null | undefined = globalThis.window,
): MediaQueryList | undefined {
  return typeof view?.matchMedia === 'function' ? view.matchMedia(query) : undefined;
}

export function prefersReducedMotion(view: Window | null | undefined = globalThis.window) {
  return mediaQuery(reducedMotionQuery, view)?.matches ?? false;
}
