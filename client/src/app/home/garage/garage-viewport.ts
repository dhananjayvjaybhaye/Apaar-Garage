import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { mediaQuery } from '../../ui/media-query';
import { heroScene, heroTransfer } from '../hero.config';

export function observeGarageViewport(
  surface: HTMLElement,
  view: Window,
  camera: PerspectiveCamera,
  renderer: () => WebGLRenderer | undefined,
  mobile: boolean,
  frame: () => void,
  visibilityChanged: (visible: boolean) => void,
  signal: AbortSignal,
) {
  const measured = { width: 0, height: 0, ratio: 0 };
  function resize(width = surface.clientWidth, height = surface.clientHeight) {
    const drawing = renderer();
    if (!drawing || signal.aborted || !width || !height) return;
    const ratio = Math.min(
      view.devicePixelRatio || 1,
      mobile ? heroScene.mobileDpr : heroScene.desktopDpr,
    );
    if (width === measured.width && height === measured.height && ratio === measured.ratio) return;
    Object.assign(measured, { width, height, ratio });
    // Layout size excludes the hero's visual transforms.
    drawing.setDrawingBufferSize(width, height, ratio);
    camera.aspect = width / height;
    frame();
  }

  const size = new ResizeObserver(([entry]) =>
    resize(entry.contentRect.width, entry.contentRect.height),
  );
  let inView = false;
  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    visibilityChanged(inView && !transferring());
  });
  size.observe(surface);
  visibility.observe(surface);
  const updateResolution = () =>
    resize(measured.width || surface.clientWidth, measured.height || surface.clientHeight);
  let resolution: MediaQueryList | undefined;
  const watchResolution = () => {
    resolution?.removeEventListener('change', watchResolution);
    resolution = mediaQuery('(resolution: ' + view.devicePixelRatio + 'dppx)', view);
    resolution?.addEventListener('change', watchResolution);
    updateResolution();
  };
  watchResolution();
  view.addEventListener('resize', updateResolution, { passive: true, signal });
  view.visualViewport?.addEventListener('resize', updateResolution, { passive: true, signal });
  const hero = surface.closest('.hero');
  const transferring = () => Boolean(hero?.hasAttribute(heroTransfer.attribute));
  hero?.addEventListener(heroTransfer.event, () => visibilityChanged(!transferring() && inView), {
    signal,
  });
  signal.addEventListener(
    'abort',
    () => {
      resolution?.removeEventListener('change', watchResolution);
      size.disconnect();
      visibility.disconnect();
    },
    { once: true },
  );
  return { measured, resize };
}
