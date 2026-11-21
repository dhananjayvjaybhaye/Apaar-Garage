import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Sphere,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { parseGltfModel } from './gltf-model';
import { prefetchedModel } from './model-prefetch';
import { mediaQuery } from '../ui/media-query';
import { motionLevel, motionQueries } from '../motion/motion-policy';
import { createEnvironment, disposeModels } from './three-resources';

interface SceneEvents {
  onProgress: (percent: number) => void;
  onReady: () => void;
  onError: () => void;
}

const idleDelayMs = 2200;

export function mountCarScene(
  canvas: HTMLCanvasElement,
  url: string,
  events: SceneEvents,
  hero = false,
) {
  const queries = motionQueries.map((query) => mediaQuery(query, canvas.ownerDocument.defaultView ?? undefined));
  let fullMotion = motionLevel(window) === 'full';
  const mobile = mediaQuery('(pointer: coarse)', canvas.ownerDocument.defaultView ?? undefined)?.matches;
  const abort = new AbortController();
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: !mobile });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.toneMapping = ACESFilmicToneMapping;

  const scene = new Scene();
  const display = new Group();
  scene.add(display);
  const camera = new PerspectiveCamera(37, 1, 0.05, 50);
  camera.position.set(2.8, 1.75, 2.9);
  if (hero) camera.position.multiplyScalar(0.75);

  const controls = new OrbitControls(camera, canvas);
  canvas.style.touchAction = 'pan-y';
  controls.enablePan = false;
  controls.enableDamping = fullMotion;
  controls.autoRotateSpeed = 0.75;
  controls.minDistance = 1.5;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.update();

  let environment: WebGLRenderTarget | undefined;
  let modelScenes: Group[] = [];
  let frame: number | null = null;
  let lastFrame = 0;
  let lastInput = performance.now();
  let interacting = false;
  let visible = false;
  let disposed = false;
  let pointer: { x: number; y: number } | null = null;
  let pointerChanged = false;
  let leanX = 0;
  let leanY = 0;

  const resizeObserver = new ResizeObserver(resize);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateVisibility();
  });

  function requestRender() {
    if (frame === null && !disposed && visible && !document.hidden && modelScenes.length > 0) {
      frame = requestAnimationFrame(render);
    }
  }

  function stopRendering() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrame = 0;
  }

  function render(now: number) {
    frame = null;
    if (!visible || document.hidden || disposed) return;
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
    lastFrame = now;
    const idle = fullMotion && !interacting && now - lastInput >= idleDelayMs;
    controls.autoRotate = idle;
    if (pointerChanged) {
      pointerChanged = false;
      const bounds = canvas.getBoundingClientRect();
      const clamp = (value: number) => Math.min(1, Math.max(-1, value));
      leanX = pointer && bounds.width ? clamp((pointer.x - bounds.left) / bounds.width * 2 - 1) * 0.10 : 0;
      leanY = pointer && bounds.height ? clamp((pointer.y - bounds.top) / bounds.height * 2 - 1) * 0.07 : 0;
    }
    const damping = fullMotion ? 1 - Math.exp(-(delta || 0.016) * 7) : 1;
    display.rotation.x += ((idle ? leanY : 0) - display.rotation.x) * damping;
    display.rotation.y += ((idle ? leanX : 0) - display.rotation.y) * damping;
    controls.update(delta);
    renderer.render(scene, camera);
    if (fullMotion) requestRender();
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height || disposed) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    requestRender();
  }

  function startInteraction() {
    interacting = true;
    controls.autoRotate = false;
    requestRender();
  }

  function endInteraction() {
    interacting = false;
    lastInput = performance.now();
    requestRender();
  }

  function updateVisibility() {
    if (visible && !document.hidden) {
      requestRender();
    } else {
      stopRendering();
    }
  }

  function follow(event: PointerEvent) {
    if (!fullMotion || event.pointerType !== 'mouse') return;
    pointer = { x: event.clientX, y: event.clientY };
    pointerChanged = true;
    requestRender();
  }

  function leave() {
    pointer = null;
    pointerChanged = true;
    requestRender();
  }

  function updateMotion() {
    fullMotion = motionLevel(window) === 'full';
    if (!fullMotion) leave();
    controls.enableDamping = fullMotion;
    controls.autoRotate = false;
    requestRender();
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    fail();
  }

  function fail() {
    if (disposed) return;
    dispose();
    events.onError();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    stopRendering();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange', updateVisibility);
    for (const query of queries) query?.removeEventListener('change', updateMotion);
    canvas.removeEventListener('pointermove', follow);
    canvas.removeEventListener('pointerleave', leave);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    controls.removeEventListener('change', requestRender);
    controls.removeEventListener('start', startInteraction);
    controls.removeEventListener('end', endInteraction);
    controls.dispose();
    disposeModels(modelScenes);
    modelScenes = [];
    scene.clear();
    scene.environment = null;
    environment?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  async function load() {
    const { buffer, basePath } = await fetchModel(url, abort.signal, events.onProgress);
    const gltf = await parseGltfModel(buffer, basePath);
    if (disposed) {
      disposeModels(gltf.scenes);
      return;
    }

    modelScenes = gltf.scenes;
    const pivot = new Group();
    pivot.add(gltf.scene);
    const { center, radius } = new Box3().setFromObject(pivot).getBoundingSphere(new Sphere());
    if (!Number.isFinite(radius) || radius <= 0) throw new Error('Empty 3D model.');

    pivot.scale.setScalar(1 / radius);
    pivot.position.copy(center).multiplyScalar(-1 / radius);
    display.add(pivot);
    environment = createEnvironment(renderer);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.8;
    const fill = new HemisphereLight(0xfff7e9, 0x696477, 0.95);
    const key = new DirectionalLight(0xffeddb, 1.55);
    key.position.set(4, 6, 3);
    scene.add(fill, key);
    lastInput = performance.now();
    events.onReady();
    requestRender();
  }

  try {
    controls.addEventListener('change', requestRender);
    controls.addEventListener('start', startInteraction);
    controls.addEventListener('end', endInteraction);
    canvas.addEventListener('webglcontextlost', onContextLost);
    document.addEventListener('visibilitychange', updateVisibility);
    for (const query of queries) query?.addEventListener('change', updateMotion);
    canvas.addEventListener('pointermove', follow, { passive: true });
    canvas.addEventListener('pointerleave', leave);
    resizeObserver.observe(canvas);
    visibilityObserver.observe(canvas);
    resize();
    void load().catch(fail);
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}

async function fetchModel(url: string, signal: AbortSignal, onProgress: SceneEvents['onProgress']) {
  const warmed = prefetchedModel(url);
  if (warmed) {
    const model = await warmed.catch(() => null);
    signal.throwIfAborted();
    if (model) return model;
  }
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('3D model request failed.');

  const basePath = new URL('.', response.url).href;
  const total = Number(response.headers.get('Content-Length'));
  if (!response.body || !total || response.headers.get('Content-Encoding')) {
    return { buffer: await response.arrayBuffer(), basePath };
  }

  let loaded = 0;
  let previousPercent = -1;
  const stream = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        loaded += chunk.byteLength;
        const percent = Math.min(99, Math.floor((loaded / total) * 100));
        if (!signal.aborted && percent !== previousPercent) {
          previousPercent = percent;
          onProgress(percent);
        }
        controller.enqueue(chunk);
      },
    }),
  );

  return { buffer: await new Response(stream).arrayBuffer(), basePath };
}
