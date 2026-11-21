import type { Renderer2 } from '@angular/core';
import type { gsap } from 'gsap';
import type { Product } from '../../catalog/product';
import type { Motion } from '../../motion/motion';
import type { PreviewPoint } from '../../product-preview/product-preview';
import { prefetchProductMedia } from '../../product-preview/prefetch-product-media';
import type { EngineLoading } from '../../ui/engine-loading';
import { heroCamera, heroLayout } from '../hero.config';
import { connectInspection } from './garage-inspection';
import type { GarageCanvasSlot } from './garage-canvas-slot';
import { zones } from './garage-path';
import type { mountGarage } from './garage-renderer';

interface SessionOptions {
  stage: HTMLElement;
  dom: Renderer2;
  motion: Motion;
  loading: EngineLoading;
  slot: GarageCanvasSlot;
  scrollProgress?: () => number;
  allowMobile?: boolean;
  activeIndex: () => number;
  readProducts: () => readonly Product[];
  push: () => number;
  dolly: () => number;
  selectProduct: (item: Product, point: PreviewPoint) => void;
  onScene: (scene: ReturnType<typeof mountGarage>) => void;
  onLive: (live: boolean) => void;
}

export function observeGarage(options: SessionOptions) {
  const { stage, motion, loading } = options;
  const view = stage.ownerDocument.defaultView;
  if (!view || typeof IntersectionObserver === 'undefined' || typeof ResizeObserver === 'undefined')
    return;
  const desktop = view.matchMedia(
    '(min-width: ' + heroLayout.columnsAtRem + 'rem) and (pointer: fine)',
  );
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
    const mobileCapable =
      options.allowMobile && (device.deviceMemory ?? 4) >= 4 && device.hardwareConcurrency >= 4;
    if (
      !disposed &&
      (desktop.matches || mobileCapable) &&
      !device.connection?.saveData &&
      (device.deviceMemory ?? 4) > 2
    )
      observer.observe(stage);
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
        if (disposed || current !== generation || !tools) return loadingJob.finish();
        loadingJob.progress(0.8);
        session = connectGarage(
          options,
          view,
          world.mountGarage,
          tools.gsap,
          !desktop.matches,
          () => loadingJob.finish(),
        );
      })
      .catch(() => loadingJob.finish());
  });
  motion.zone.runOutsideAngular(() => {
    desktop.addEventListener('change', refresh);
    refresh();
  });
  return {
    select: (index: number) => session?.select(index),
    scrollTo: (progress: number, index: number) => session?.setScrollFrame(progress, index),
    inspect: (...args: Parameters<ReturnType<typeof connectInspection>['inspect']>) =>
      session?.inspect(...args),
    destroy() {
      disposed = true;
      desktop.removeEventListener('change', refresh);
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
  const playhead = { progress: options.scrollProgress?.() ?? zones[options.activeIndex()].center };
  let activeZone = options.activeIndex();
  let canvas: HTMLCanvasElement | undefined;
  let still: HTMLImageElement | undefined;
  let scene: ReturnType<typeof mountGarage> = null;
  let cancelled = false;
  let held = false;
  let releaseCanvas: (() => void) | undefined;

  function dropScene() {
    scene?.destroy();
    scene = null;
    options.onScene(null);
    canvas?.remove();
    canvas = undefined;
    releaseCanvas?.();
    releaseCanvas = undefined;
  }

  function destroy() {
    if (cancelled) return;
    cancelled = true;
    finish();
    animator.killTweensOf(playhead);
    inspection.destroy();
    options.onLive(false);
    dropScene();
    still?.remove();
  }

  function start() {
    releaseCanvas = options.slot.claim(destroy);
    const surface: HTMLCanvasElement = dom.createElement('canvas');
    canvas = surface;
    Object.assign(surface.style, { width: '100%', height: '100%', display: 'block' });
    stage.append(surface);
    scene = create(
      surface,
      {
        select: (product, point) => motion.zone.run(() => options.selectProduct(product, point)),
        prefetch: prefetchProductMedia,
        failed: destroy,
        ready: () => {
          finish();
          still?.remove();
          still = undefined;
          options.onLive(true);
        },
      },
      mobile,
      Boolean(options.scrollProgress),
    );
    if (!scene) return false;
    if (options.scrollProgress) scene.setTourFrame(playhead.progress, activeZone);
    else scene.setProgress(playhead.progress);
    scene.pushIn(options.push());
    scene.setDolly(options.dolly());
    scene.setFeatured(options.readProducts());
    options.onScene(scene);
    return true;
  }

  function select(index: number) {
    if (held || cancelled) return;
    motion.zone.runOutsideAngular(() => {
      if (playhead.progress === zones[index].center && !animator.isTweening(playhead)) return;
      animator.killTweensOf(playhead);
      animator.to(playhead, {
        progress: zones[index].center,
        duration: heroCamera.tabSeconds,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: () => scene?.setProgress(playhead.progress),
      });
    });
  }

  function setScrollFrame(progress: number, index: number) {
    playhead.progress = progress;
    activeZone = index;
    if (!held) scene?.setTourFrame(progress, index);
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
    restart: start,
    freeze,
    holdSelection: (hold) => {
      held = hold;
      if (hold) animator.killTweensOf(playhead);
      else if (options.scrollProgress) scene?.setTourFrame(playhead.progress, activeZone);
      else if (playhead.progress !== zones[options.activeIndex()].center)
        select(options.activeIndex());
    },
    select: options.selectProduct,
    fallback: destroy,
  });

  try {
    if (!start()) destroy();
  } catch {
    destroy();
  }
  return { inspect: inspection.inspect, select, setScrollFrame, destroy };
}
