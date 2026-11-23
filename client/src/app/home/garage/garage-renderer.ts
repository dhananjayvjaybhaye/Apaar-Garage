import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { mediaQuery } from '../../ui/media-query';
import type { Product } from '../../catalog/product';
import { disposeModels } from '../../car-viewer/three-resources';
import { heroLayout, heroScene, heroSteps } from '../hero.config';
import { createGarageModels, type GarageBay } from './garage-models';
import type { RcBenchStatus } from './garage-path';
import { heroCameraAt, heroZones } from './hero-garage-camera';
import { createHeroGarage } from './hero-garage-scene';

interface GarageEvents {
  select: (product: Product, point: { x: number; y: number }) => void;
  prefetch: (product: Product) => void;
  hover?: (item: { product: Product; x: number; y: number } | undefined) => void;
  failed: () => void;
  prepared: () => void;
  ready?: () => void;
}

export function mountGarage(canvas: HTMLCanvasElement, events: GarageEvents, mobile: boolean) {
  const surface = canvas.parentElement;
  const document = canvas.ownerDocument;
  const view = document.defaultView;
  if (!surface || !view) return null;
  let renderer: WebGLRenderer | undefined;
  const scene = new Scene();
  let bays: GarageBay[] = [];
  let animate:
    | ((time: number, active: number, blend: number, immediate: boolean, signX: number) => void)
    | undefined;
  let models: ReturnType<typeof createGarageModels> | undefined;
  let featured: readonly Product[] = [];
  let rcStatus: RcBenchStatus = 'loading';
  const camera = new PerspectiveCamera(heroScene.fieldOfView, 1, 0.1, 85);
  const ray = new Raycaster();
  const ndc = new Vector2();
  let disposed = false;
  let visible = false;
  let frame = 0;
  let index = 0;
  let move: { from: number; start: number; done: () => void } | undefined;

  function finishMove() {
    const done = move?.done;
    move = undefined;
    done?.();
  }
  let snapLighting = true;
  let pointer: { x: number; y: number } | null = null;
  let mx = 0;
  let my = 0;
  let hover: Product | undefined;
  let painted = false;
  let mediaReady = false;
  let inspection: { x: number; amount: number } | undefined;
  let pressed: { x: number; y: number } | undefined;

  let drag: { x: number; y: number } | undefined;
  let touch: number | undefined;
  function* prepare() {
    const context = canvas.getContext('webgl2', {
      antialias: !mobile,
      powerPreference: 'low-power',
    });
    if (!context) throw new Error('WebGL 2 is unavailable.');
    renderer = new WebGLRenderer({ canvas, context, antialias: !mobile });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.23;
    resize();
    yield;
    ({ bays, animate } = yield* createHeroGarage(scene, document, mobile));
    yield;
    models = createGarageModels(bays, heroZones, () => !disposed, requestFrame, document, mobile);
    models.select(index);
    // Paint the scene before starting media work, with the matching backdrop underneath.
  }

  const preparation = prepare();
  let preparationFrame = view.requestAnimationFrame(prepareFrame);

  function prepareFrame() {
    if (disposed) return;
    try {
      if (!preparation.next().done) preparationFrame = view!.requestAnimationFrame(prepareFrame);
      else {
        events.prepared();
        requestFrame();
      }
    } catch {
      events.failed();
    }
  }

  function pick(x: number, y: number) {
    if (!painted || !visible) return undefined;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return undefined;
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, (1 - (y - rect.top) / rect.height) * 2 - 1);
    ray.setFromCamera(ndc, camera);
    const eligible = bays.filter((bay) => bay.product);
    const object = ray.intersectObjects(
      eligible.map((bay) => bay.hit),
      false,
    )[0]?.object;
    return eligible.find((bay) => bay.hit === object)?.product;
  }

  let overlayFrame = 0;

  function requestFrame() {
    if (models && !frame && !overlayFrame && !disposed && visible && !document.hidden)
      frame = requestAnimationFrame((time) => {
        try {
          render(time);
        } catch {
          frame = 0;
          events.failed();
        }
      });
  }

  function prioritizeOverlay() {
    pause();
    if (overlayFrame) return;
    // Keep WebGL drawing out of the frame that first presents the dialog.
    overlayFrame = requestAnimationFrame(() => {
      overlayFrame = 0;
      requestFrame();
    });
  }

  function render(time: number) {
    frame = 0;
    if (!renderer || !measured.width || !visible || disposed || document.hidden) return;
    const targetX = pointer ? (pointer.x / canvas.clientWidth) * 2 - 1 : (drag?.x ?? 0);
    const targetY = pointer ? (pointer.y / canvas.clientHeight) * 2 - 1 : (drag?.y ?? 0);
    mx += (targetX - mx) * 0.18;
    my += (targetY - my) * 0.18;
    const compact = measured.width < heroLayout.stackedWidthPx;
    const phase = move ? Math.min(1, Math.max(0, (time - move.start) / heroSteps.moveMs)) : 1;
    const base = heroCameraAt(index, measured.width, measured.height, compact, move?.from, phase);
    const drift =
      index === 0 || move
        ? 0
        : Math.sin((time * 2 * Math.PI) / heroScene.driftCycleMs) * heroScene.drift;
    const blend = inspection?.amount ?? 0;
    const x = inspection?.x ?? base.lookX;
    const mix = (from: number, to: number) => from + (to - from) * blend;
    const { width, height } = measured;
    const offsetX = width * (0.5 - base.screenX);
    const offsetY = height * (0.5 - base.screenY);
    const viewOffset = camera.view;
    if (
      viewOffset?.fullWidth !== width ||
      viewOffset.fullHeight !== height ||
      viewOffset.offsetX !== offsetX ||
      viewOffset.offsetY !== offsetY
    ) {
      camera.setViewOffset(width, height, offsetX, offsetY, width, height);
    }
    camera.position.set(
      mix(base.x, x + 0.9) + (mx * heroScene.parallax + drift) * (1 - blend),
      mix(base.y, 2.55) - my * 0.16 * (1 - blend),
      mix(base.z, 4.8),
    );
    camera.lookAt(
      mix(base.lookX, x) + mx * 0.16 * (1 - blend),
      mix(base.lookY, 1.85) - my * 0.13 * (1 - blend),
      mix(base.lookZ, -1.5),
    );
    camera.updateMatrixWorld();
    const immediate = snapLighting || (index === 0 && !move) || (!!move && phase === 1);
    snapLighting = false;
    const previousHover = hover;
    if (pointer) {
      const rect = canvas.getBoundingClientRect();
      hover = pick(
        rect.left + (pointer.x * rect.width) / canvas.clientWidth,
        rect.top + (pointer.y * rect.height) / canvas.clientHeight,
      );
    } else hover = undefined;
    if (hover?.slug !== previousHover?.slug) {
      if (hover) events.prefetch(hover);
      events.hover?.(hover && pointer ? { product: hover, ...pointer } : undefined);
    }
    canvas.classList.toggle('garage-hovering', Boolean(hover));

    bays.forEach((bay, bayIndex) => {
      const lit = bayIndex === index;
      const hovered = Boolean(hover && hover.slug === bay.product?.slug);
      bay.focus = immediate ? Number(lit) : bay.focus + (Number(lit) - bay.focus) * 0.19;
      bay.setFocus(bay.focus);
      const brightness =
        heroScene.inactiveBrightness + bay.focus * (1 - heroScene.inactiveBrightness);
      bay.card?.material.color.setScalar(brightness);
      const intensity = heroScene.activeLight * brightness + (hovered ? heroScene.hoverLight : 0);
      bay.lightIntensity = immediate
        ? intensity
        : bay.lightIntensity + (intensity - bay.lightIntensity) * 0.19;
      if (bay.light) bay.light.intensity = bay.lightIntensity;
      bay.rail.emissiveIntensity = 0.14 + bay.lightIntensity / 26;
      const opacity = hovered ? 0.95 : lit ? 0.25 : 0.06;
      bay.halo.material.opacity = immediate
        ? opacity
        : bay.halo.material.opacity + (opacity - bay.halo.material.opacity) * 0.2;
    });
    animate?.(time, index, blend, immediate, base.signX);
    renderer.render(scene, camera);
    if (phase === 1) finishMove();
    if (!painted) {
      painted = true;
      events.ready?.();
      preparationFrame = view!.requestAnimationFrame(() => {
        if (disposed) return;
        mediaReady = true;
        models?.setFeatured(featured, rcStatus);
      });
    }
    requestFrame();
  }

  let measured = { width: 0, height: 0, ratio: 0 };
  function resize(width = surface!.clientWidth, height = surface!.clientHeight) {
    if (!renderer || disposed || !width || !height) return;
    const ratio = Math.min(
      view!.devicePixelRatio || 1,
      mobile ? heroScene.mobileDpr : heroScene.desktopDpr,
    );
    if (width === measured.width && height === measured.height && ratio === measured.ratio) return;
    measured = { width, height, ratio };
    // Use the untransformed stage size, so the animated frame never changes the viewport buffer.
    renderer.setDrawingBufferSize(width, height, ratio);
    camera.aspect = width / height;
    requestFrame();
  }

  const size = new ResizeObserver(([entry]) =>
    resize(entry.contentRect.width, entry.contentRect.height),
  );
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) requestFrame();
    else pause();
  });
  const handlers = new AbortController();
  const signal = handlers.signal;
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
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        pause();
        // The hidden tab cannot render intermediate frames. The first visible frame is the target.
        if (move) {
          finishMove();
          snapLighting = true;
        }
      } else requestFrame();
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId === touch && pressed) {
        drag = {
          x: Math.max(-1, Math.min(1, (event.clientX - pressed.x) / heroScene.dragRangePx)),
          y: Math.max(-1, Math.min(1, (event.clientY - pressed.y) / heroScene.dragRangePx)),
        };
        requestFrame();
        return;
      }
      if (event.pointerType !== 'mouse') return;
      // Pointer parallax is a small offset on top of the zone camera.
      pointer = { x: event.offsetX, y: event.offsetY };
      requestFrame();
    },
    { passive: true, signal },
  );
  canvas.addEventListener(
    'pointerleave',
    () => {
      pointer = null;
      requestFrame();
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      pressed = { x: event.clientX, y: event.clientY };
      if (event.pointerType === 'touch') {
        touch = event.pointerId;
        const product = pick(event.clientX, event.clientY);
        if (product) events.prefetch(product);
      }
    },
    { passive: true, signal },
  );
  function clearDrag(event: PointerEvent) {
    if (event.pointerId !== touch) return;
    touch = undefined;
    drag = undefined;
    requestFrame();
  }
  canvas.addEventListener('pointerup', clearDrag, { signal });
  canvas.addEventListener('pointercancel', clearDrag, { signal });
  canvas.addEventListener(
    'click',
    (event) => {
      const start = pressed;
      pressed = undefined;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
      const product = pick(event.clientX, event.clientY);
      if (product) events.select(product, { x: event.clientX, y: event.clientY });
    },
    { signal },
  );
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      events.failed();
    },
    { signal },
  );
  resize();

  function pause() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  return {
    prioritizeOverlay,
    productAt: pick,
    setFeatured(products: readonly Product[], status: RcBenchStatus) {
      featured = products;
      rcStatus = status;
      if (mediaReady) models?.setFeatured(products, rcStatus);
    },
    setZone(value: number, onDone?: () => void) {
      const from = index;
      finishMove();
      index = value;
      if (onDone && painted && visible && !document.hidden && from !== value) {
        move = { from, start: view.performance.now(), done: onDone };
      } else {
        snapLighting = true;
        onDone?.();
      }
      models?.select(index);
      requestFrame();
    },
    focus(x: number, amount: number) {
      inspection = amount > 0 ? { x, amount } : undefined;
      requestFrame();
    },
    pointFor(product: Product) {
      const bay = bays.find((bay) => bay.product?.slug === product.slug);
      if (!bay) return undefined;
      const rect = canvas.getBoundingClientRect();
      const point = bay.hit.getWorldPosition(new Vector3()).project(camera);
      return {
        x: Math.max(rect.left, Math.min(rect.right, rect.left + ((point.x + 1) * rect.width) / 2)),
        y: Math.max(rect.top, Math.min(rect.bottom, rect.top + ((1 - point.y) * rect.height) / 2)),
      };
    },
    photograph() {
      if (!renderer || !painted || disposed) return undefined;
      renderer.render(scene, camera);
      return canvas.toDataURL('image/jpeg', 0.84);
    },
    destroy() {
      disposed = true;
      finishMove();
      pause();
      view.cancelAnimationFrame(preparationFrame);
      preparation.return();
      if (overlayFrame) cancelAnimationFrame(overlayFrame);
      handlers.abort();
      resolution?.removeEventListener('change', watchResolution);
      size.disconnect();
      visibility.disconnect();
      models?.destroy();
      disposeModels([scene]);
      scene.clear();
      renderer?.dispose();
      renderer?.forceContextLoss();
    },
  };
}
