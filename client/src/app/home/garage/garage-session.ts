import type { Renderer2 } from '@angular/core';
import type { gsap } from 'gsap';
import type { Product } from '../../catalog/product';
import type { Motion } from '../../motion/motion';
import { mediaQuery } from '../../ui/media-query';
import { motionQueries } from '../../motion/motion-policy';
import type { PreviewPoint } from '../../product-preview/product-preview';
import { prefetchProductMedia } from '../../product-preview/prefetch-product-media';
import type { EngineLoading } from '../../ui/engine-loading';
import { connectInspection } from './garage-inspection';
import { garageZoneFor } from './garage-path';
import { heroZones } from './hero-garage-camera';
import type { mountGarage } from './garage-renderer';

interface SessionOptions {
  stage: HTMLElement;
  dom: Renderer2;
  motion: Motion;
  loading: EngineLoading;
  manual: boolean;
  scrollProgress: () => number;
  activeIndex: () => number;
  readProducts: () => readonly Product[];
  selectProduct: (item: Product, point: PreviewPoint) => void;
  hoverProduct?: NonNullable<Parameters<typeof mountGarage>[1]['hover']>;
  onUnavailable?: () => void;
  onScene: (scene: ReturnType<typeof mountGarage>) => void;
  onLive: (live: boolean) => void;
}

export function observeGarage(options: SessionOptions) {
  const { stage, motion, loading } = options;
  const view = stage.ownerDocument.defaultView;
  if (
    !view ||
    typeof IntersectionObserver === 'undefined' ||
    typeof ResizeObserver === 'undefined'
  ) {
    options.onUnavailable?.();
    return;
  }
  const desktop = mediaQuery(motionQueries[2] + ' and (pointer: fine)', view);
  const device = view.navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  let session: ReturnType<typeof connectGarage> | undefined;
  let job: ReturnType<EngineLoading['begin']> | undefined;
  let disposed = false;
  let generation = 0;

  const stop = () => {
    generation++;
    session?.destroy();
    session = undefined;
    job?.finish();
    job = undefined;
  };
  const refresh = () => {
    observer.disconnect();
    stop();
    const enoughCores = !device.hardwareConcurrency || device.hardwareConcurrency >= 4;
    if (
      !disposed &&
      (options.manual ||
        (desktop?.matches &&
          enoughCores &&
          !device.connection?.saveData &&
          (device.deviceMemory ?? 4) > 2))
    )
      observer.observe(stage);
    else options.onUnavailable?.();
  };
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) {
      stop();
      return;
    }
    if (session || job) return;
    const current = generation;
    const loadingJob = (job = loading.begin());
    void Promise.all([motion.loadScrollTools(), import('./garage-renderer')])
      .then(([tools, world]) => {
        if (disposed || current !== generation) return loadingJob.finish();
        if (!tools) {
          options.onUnavailable?.();
          return loadingJob.finish();
        }
        loadingJob.progress(0.8);
        session = motion.zone.runOutsideAngular(() =>
          connectGarage(
            options,
            view,
            world.mountGarage,
            tools.gsap,
            options.manual || !desktop?.matches,
            () => loadingJob.finish(),
          ),
        );
      })
      .catch(() => {
        if (!disposed && current === generation) options.onUnavailable?.();
        loadingJob.finish();
      });
  });
  motion.zone.runOutsideAngular(() => {
    desktop?.addEventListener('change', refresh);
    refresh();
  });
  return {
    scrollTo: (progress: number, index: number) => session?.setScrollFrame(progress, index),
    inspect: (...args: Parameters<ReturnType<typeof connectInspection>['inspect']>) =>
      session?.inspect(...args),
    destroy() {
      disposed = true;
      desktop?.removeEventListener('change', refresh);
      observer.disconnect();
      stop();
    },
  };
}

function connectGarage(
  options: SessionOptions,
  view: Window,
  create: typeof mountGarage,
  animator: typeof gsap,
  mobile: boolean,
  finish: () => void,
) {
  const { stage, motion, dom } = options;
  let progress = options.scrollProgress();
  let activeZone = options.activeIndex();
  let canvas: HTMLCanvasElement | undefined;
  let still: HTMLImageElement | undefined;
  let scene: ReturnType<typeof mountGarage> = null;
  let cancelled = false;
  let held = false;

  function dropScene() {
    scene?.destroy();
    scene = null;
    options.onScene(null);
    canvas?.remove();
    canvas = undefined;
  }

  function destroy() {
    if (cancelled) return;
    cancelled = true;
    finish();
    inspection.destroy();
    options.onLive(false);
    dropScene();
    still?.remove();
  }

  function start() {
    const surface: HTMLCanvasElement = dom.createElement('canvas');
    canvas = surface;
    Object.assign(surface.style, { width: '100%', height: '100%', display: 'block' });
    stage.append(surface);
    scene = create(
      surface,
      {
        select: (product, point) => motion.zone.run(() => options.selectProduct(product, point)),
        prefetch: prefetchProductMedia,
        hover:
          options.hoverProduct && ((item) => motion.zone.run(() => options.hoverProduct?.(item))),
        failed: fallback,
        ready: () => {
          finish();
          still?.remove();
          still = undefined;
          options.onLive(true);
        },
      },
      mobile,
    );
    if (!scene) return false;
    scene.setScrollFrame(progress, activeZone);
    scene.setFeatured(options.readProducts());
    options.onScene(scene);
    return true;
  }

  function setScrollFrame(value: number, index: number) {
    progress = value;
    activeZone = index;
    if (!held) scene?.setScrollFrame(progress, activeZone);
  }

  function fallback() {
    options.onUnavailable?.();
    destroy();
  }

  async function freeze(signal: AbortSignal, ready: () => void) {
    if (signal.aborted || cancelled) return;
    let image: string | undefined;
    try {
      image = scene?.photograph();
    } catch {
      // The original photo remains beneath the canvas if capture is unavailable.
      options.onLive(false);
    }
    if (image) {
      const frame: HTMLImageElement = dom.createElement('img');
      frame.className = 'garage-still';
      frame.alt = '';
      frame.src = image;
      await frame.decode().catch(() => undefined);
      if (signal.aborted || cancelled) return;
      still?.remove();
      still = frame;
      stage.append(frame);
    } else options.onLive(false);
    dropScene();
    ready();
  }

  const inspection = connectInspection({
    stage,
    view,
    zone: motion.zone,
    animator,
    read: () => scene,
    cancelled: () => cancelled,
    restart: () => motion.zone.runOutsideAngular(start),
    freeze,
    holdSelection: (hold) => {
      held = hold;
      if (!hold) scene?.setScrollFrame(progress, activeZone);
    },
    zoneX: (product) =>
      heroZones.find(({ category }) => category === garageZoneFor(product))?.x ?? 0,
    select: options.selectProduct,
    fallback,
  });

  try {
    if (!start()) fallback();
  } catch {
    fallback();
  }
  return { inspect: inspection.inspect, setScrollFrame, destroy };
}
