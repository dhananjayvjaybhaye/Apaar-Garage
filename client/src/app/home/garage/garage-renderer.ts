import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { mediaQuery } from '../../ui/media-query';
import type { Product } from '../../catalog/product';
import { disposeModels } from '../../car-viewer/three-resources';
import { heroScene } from '../hero.config';
import { createGarageModels } from './garage-models';
import { heroCameraAt, heroZoneAt, heroZones } from './hero-garage-camera';
import { createHeroGarage } from './hero-garage-scene';

interface GarageEvents {
  select: (product: Product, point: { x: number; y: number }) => void;
  prefetch: (product: Product) => void;
  hover?: (item: { product: Product; x: number; y: number } | undefined) => void;
  failed: () => void;
  ready?: () => void;
}

export function mountGarage(canvas: HTMLCanvasElement, events: GarageEvents, mobile: boolean) {
  const surface = canvas.parentElement;
  const document = canvas.ownerDocument;
  const view = document.defaultView;
  if (!surface || !view) return null;
  const context = canvas.getContext('webgl2', { antialias: !mobile, powerPreference: 'low-power' });
  if (!context) return null;
  const renderer = new WebGLRenderer({ canvas, context, antialias: !mobile });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.23;

  const camera = new PerspectiveCamera(heroScene.fieldOfView, 1, 0.1, 85);
  const { scene, bays, animate } = createHeroGarage(document, mobile);
  const ray = new Raycaster();
  const ndc = new Vector2();
  let disposed = false;
  let visible = false;
  let frame = 0;
  let progress = 0;
  let activeZone: number | undefined;
  let pointer: { x: number; y: number } | null = null;
  let mx = 0;
  let my = 0;
  let hover: Product | undefined;
  let painted = false;
  let inspection: { x: number; amount: number } | undefined;
  let pressed: { x: number; y: number } | undefined;

  let drag: { x: number; y: number } | undefined;
  let touch: number | undefined;
  const models = createGarageModels(bays, heroZones, () => !disposed, requestFrame);

  function pick(x: number, y: number) {
    if (!visible || progress > 0.975) return undefined;
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
    if (!frame && !overlayFrame && !disposed && visible && !document.hidden)
      frame = requestAnimationFrame(render);
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
    if (!visible || disposed || document.hidden) return;
    const targetX = pointer ? (pointer.x / canvas.clientWidth) * 2 - 1 : (drag?.x ?? 0);
    const targetY = pointer ? (pointer.y / canvas.clientHeight) * 2 - 1 : (drag?.y ?? 0);
    mx += (targetX - mx) * 0.18;
    my += (targetY - my) * 0.18;
    const compact = mobile || camera.aspect < heroScene.maximumCompactAspect;
    const base = heroCameraAt(progress, camera.aspect, compact);
    const drift = Math.sin((time * 2 * Math.PI) / heroScene.driftCycleMs) * heroScene.drift;
    const blend = inspection?.amount ?? 0;
    const x = inspection?.x ?? base.lookX;
    const mix = (from: number, to: number) => from + (to - from) * blend;
    camera.position.set(
      mix(base.x, x + 0.9) + (mx * heroScene.parallax + drift) * (1 - blend),
      mix(base.y, 2.55) - my * 0.16 * (1 - blend),
      mix(base.z, 4.8),
    );
    camera.lookAt(
      mix(base.lookX, x) + mx * 0.16 * (1 - blend),
      mix(base.lookY, 1.85) - my * 0.13 * (1 - blend),
      -1.5,
    );
    camera.updateMatrixWorld();
    const index = activeZone ?? heroZoneAt(progress);
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
      const intensity =
        (lit ? heroScene.activeLight : heroScene.idleLight) + (hovered ? heroScene.hoverLight : 0);
      bay.light.intensity += (intensity - bay.light.intensity) * 0.19;
      bay.rail.emissiveIntensity = 0.14 + bay.light.intensity / 26;
      const opacity = hovered ? 0.95 : lit ? 0.25 : 0.06;
      bay.halo.material.opacity += (opacity - bay.halo.material.opacity) * 0.2;
    });
    animate(time, index, blend);
    renderer.render(scene, camera);
    if (!painted) {
      painted = true;
      events.ready?.();
    }
    requestFrame();
  }

  let measured = { width: 0, height: 0, ratio: 0 };
  function resize(width = surface!.clientWidth, height = surface!.clientHeight) {
    if (disposed || !width || !height) return;
    const ratio = Math.min(
      view!.devicePixelRatio || 1,
      mobile ? heroScene.mobileDpr : heroScene.desktopDpr,
    );
    if (width === measured.width && height === measured.height && ratio === measured.ratio) return;
    measured = { width, height, ratio };
    // Use the untransformed stage size, so the animated frame never changes the viewport buffer.
    renderer.setDrawingBufferSize(width, height, ratio);
    camera.aspect = width / height;
    const compact = mobile || camera.aspect < heroScene.maximumCompactAspect;
    const offset = compact ? heroScene.mobileOffset : heroScene.desktopOffset;
    camera.setViewOffset(width, height, -width * offset, 0, width, height);
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
    () => (document.hidden ? pause() : requestFrame()),
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
      // Pointer parallax is a small offset on top of the tab position and scroll dolly.
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
    setFeatured: models.setFeatured,
    setScrollFrame(value: number, index: number) {
      models.select(index);
      progress = value;
      activeZone = index;
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
      if (!painted || disposed) return undefined;
      renderer.render(scene, camera);
      return canvas.toDataURL('image/jpeg', 0.84);
    },
    destroy() {
      disposed = true;
      pause();
      if (overlayFrame) cancelAnimationFrame(overlayFrame);
      handlers.abort();
      resolution?.removeEventListener('change', watchResolution);
      size.disconnect();
      visibility.disconnect();
      for (const bay of bays) bay.request?.abort();
      disposeModels([scene]);
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
