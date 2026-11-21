import {
  ACESFilmicToneMapping, AmbientLight, Box3, BoxGeometry, CanvasTexture, Color, Fog, Group,
  HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry,
  PointLight, Raycaster, RingGeometry, Scene, SRGBColorSpace, TextureLoader, Vector2, Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Product } from '../../catalog/product';
import { disposeModels } from '../../car-viewer/three-resources';
import { cameraAt, ease, garageZoneFor, zoneAt, zones } from './garage-path';
import { heroCamera } from '../hero.config';
import { tourCamera } from '../garage-tour.config';
import { tourCameraAt } from './garage-tour-camera';

interface GarageEvents {
  select: (product: Product, point: { x: number; y: number }) => void;
  prefetch: (product: Product) => void;
  failed: () => void;
  ready?: () => void;
}

export function mountGarage(canvas: HTMLCanvasElement, events: GarageEvents, mobile: boolean, tour: boolean) {
  const surface = canvas.parentElement;
  const view = canvas.ownerDocument.defaultView;
  if (!surface || !view) return null;
  const context = canvas.getContext('webgl2', { antialias: !mobile, powerPreference: 'low-power' });
  if (!context) return null;
  const renderer = new WebGLRenderer({ canvas, context, antialias: !mobile });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.23;

  const scene = new Scene();
  scene.background = new Color('#211413');
  scene.fog = new Fog('#211413', 19, 39);
  const camera = new PerspectiveCamera(tour ? tourCamera.fov : heroCamera.fieldOfView, 1, 0.1, 85);
  scene.add(new HemisphereLight('#f7d9b1', '#2c242a', 1.26), new AmbientLight('#b9a193', 0.29));

  const metal = new MeshStandardMaterial({ color: '#272324', metalness: 0.38, roughness: 0.59 });
  const wall = new MeshStandardMaterial({ color: '#35282a', roughness: 0.83 });
  const deck = new MeshStandardMaterial({ color: '#574438', roughness: 0.7 });
  const amber = new MeshStandardMaterial({ color: '#b6692c', emissive: '#ee7426', emissiveIntensity: 1.08 });
  const cement = new MeshStandardMaterial({ color: '#514140', roughness: 0.82, metalness: 0.06 });
  const roomDepth = tour ? 48 : 19;
  const roomCenter = roomDepth / 2 - 5.35;
  const floor = new Mesh(new PlaneGeometry(34, roomDepth + 9), cement);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = tour ? roomCenter : 4;
  scene.add(floor);

  function box(parent: Group | Scene, x: number, y: number, z: number, w: number, h: number, d: number, material: MeshStandardMaterial) {
    const mesh = new Mesh(new BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  box(scene, 0, 3.6, -5.35, 31, 7.2, 0.35, wall);
  box(scene, -15.5, 3.6, roomCenter, 0.4, 7.2, roomDepth, wall);
  box(scene, 15.5, 3.6, roomCenter, 0.4, 7.2, roomDepth, wall);
  box(scene, 0, 7.1, roomCenter, 31, 0.3, roomDepth, metal);
  for (let x = -14; x <= 14; x += 2.8) box(scene, x, 3.6, -5.1, 0.12, 7, 0.18, metal);
  for (let z = -1.0; z <= 8; z += 4.35) box(scene, 0, 6.72, z, 31, 0.32, 0.32, metal);

  function sign(text: string, width: number, x: number, y: number, z: number) {
    const label = document.createElement('canvas');
    label.width = 512;
    label.height = 96;
    const brush = label.getContext('2d');
    if (!brush) return;
    brush.fillStyle = '#28191a';
    brush.fillRect(0, 0, label.width, label.height);
    brush.strokeStyle = '#a96e43';
    brush.strokeRect(3, 3, label.width - 6, label.height - 6);
    brush.fillStyle = '#ffd29b';
    brush.font = 'bold 49px system-ui';
    brush.textAlign = 'center';
    brush.textBaseline = 'middle';
    brush.fillText(text, 256, 49);
    const map = new CanvasTexture(label);
    map.colorSpace = SRGBColorSpace;
    const face = new Mesh(new PlaneGeometry(width, width * 0.1875), new MeshBasicMaterial({ map, toneMapped: false }));
    face.position.set(x, y, z);
    scene.add(face);
    return face;
  }

  const wordmark = sign('APAAR GARAGE', tour ? tourCamera.signWidth : 5.25, 0, tour ? tourCamera.signHeight : 5.75, -4.99);

  const track = new MeshStandardMaterial({ color: '#312f31', roughness: 0.92 });
  const markers = new MeshStandardMaterial({ color: '#e1b584', roughness: 0.8 });
  const bays = zones.map(({ x, name, category }) => {
    const bay = new Group();
    const rail = amber.clone();
    bay.position.x = x;
    scene.add(bay);
    box(bay, 0, 1.04, -1.45, 5.05, 0.27, 2.25, deck);
    box(bay, 0, 0.8, -1.45, 5.05, 0.16, 2.28, metal);
    box(bay, 0, 0.82, -0.29, 4.45, 0.026, 0.035, rail);
    if (category === 'rc') {
      box(bay, 0, 0.04, 1.82, 4.75, 0.08, 4, track);
      for (const side of [-2.16, 2.16]) box(bay, side, 0.09, 1.82, 0.13, 0.06, 3.85, rail);
      for (const offset of [-0.17, 0.1, 0.37, 0.64]) box(bay, 0, 0.087, 1.55 + offset * 2, 0.06, 0.014, 0.31, markers);
      sign('RC WORKBENCH', 3.5, x, 3.48, -2.72);
    } else {
      box(bay, 0, 3.31, -2.25, 5.05, 0.22, 1.8, metal);
      box(bay, 0, 3.17, -1.44, 4.55, 0.038, 0.13, rail);
      sign(name.toUpperCase(), 2.2, x, 3.74, -2.69);
    }
    box(bay, 0, 0.017, 4.2, 4.92, 0.025, 0.045, rail);
    for (const side of [-2.4, 2.4]) {
      box(bay, side, 1.7, -2.93, 0.16, 3.4, 0.19, metal);
      box(bay, side, 0.55, -0.58, 0.19, 1.1, 0.2, metal);
    }

    const light = new PointLight('#ffc27c', 19, 12, 1.6);
    light.position.set(0, 3.0, -0.15);
    bay.add(light);

    const halo = new Mesh(new RingGeometry(0.99, 1.12, 48), new MeshBasicMaterial({
      color: '#ffb663', transparent: true, opacity: 0, depthWrite: false,
    }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0, 1.185, -1.41);
    bay.add(halo);

    const display = new Group();
    display.position.set(0, 1.18, -1.48);
    bay.add(display);
    const hit = new Mesh(new BoxGeometry(3.35, 1.85, 1.95), new MeshBasicMaterial({
      colorWrite: false, depthWrite: false,
    }));
    hit.position.set(0, 2.08, -1.35);
    bay.add(hit);
    return {
      display, hit, halo, light, rail,
      product: undefined as Product | undefined,
      request: undefined as AbortController | undefined,
      hasModel: false,
    };
  });

  const ray = new Raycaster();
  const bikeStop = zones[2].center;
  const rcStop = zones[3].center;
  const ndc = new Vector2();
  const center = new Vector3();
  const loader = new TextureLoader();
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
  let introPush = 0;
  let dolly = 0;
  let displayWidthDistance = 0;
  let lastIntroDraw = 0;
  let pressed: { x: number; y: number } | undefined;

  function clear(display: Group) {
    disposeModels([display]);
    display.clear();
  }

  function setFeatured(products: readonly Product[]) {
    zones.forEach(({ category }, index) => {
      const product = products.find((entry) => garageZoneFor(entry) === category);
      const bay = bays[index];
      if (bay.product?.slug === product?.slug &&
          bay.product?.images[0] === product?.images[0] && bay.product?.glbUrl === product?.glbUrl) {
        bay.product = product;
        return;
      }

      bay.request?.abort();
      clear(bay.display);
      bay.product = product;
      bay.hasModel = false;
      if (!product) return;
      const request = new AbortController();
      bay.request = request;
      const live = () => !disposed && !request.signal.aborted;

      if (product.images[0]) {
        loader.load(product.images[0], (texture) => {
          if (!live() || bay.hasModel) {
            texture.dispose();
            return;
          }
          texture.colorSpace = SRGBColorSpace;
          const image = new Mesh(new PlaneGeometry(2.62, 1.94), new MeshBasicMaterial({ map: texture, toneMapped: false }));
          image.position.set(0, 1.02, 0.19);
          bay.display.add(image);
          requestFrame();
        }, undefined, () => {});
      }

      const modelUrl = product.glbUrl;
      if (modelUrl) {
        void (async () => {
          const response = await fetch(modelUrl, { signal: request.signal });
          if (!response.ok) return;
          const buffer = await response.arrayBuffer();
          if (!live()) return;
          const model = await new GLTFLoader().parseAsync(buffer, new URL('.', response.url).href);
          if (!live()) {
            disposeModels(model.scenes);
            return;
          }
          const bounds = new Box3().setFromObject(model.scene);
          const dimensions = bounds.getSize(new Vector3());
          const size = Math.max(dimensions.x, dimensions.y, dimensions.z);
          if (!Number.isFinite(size) || size <= 0) {
            disposeModels(model.scenes);
            return;
          }
          // Release resources belonging only to alternate GLTF scenes when replacing this display too.
          clear(bay.display);
          for (const alternate of model.scenes) {
            if (alternate !== model.scene) {
              alternate.visible = false;
              bay.display.add(alternate);
            }
          }
          const pivot = new Group();
          pivot.add(model.scene);
          bounds.getCenter(center);
          const scale = 2.8 / size;
          pivot.scale.setScalar(scale);
          pivot.position.set(-center.x * scale, -bounds.min.y * scale + 0.08, -center.z * scale);
          bay.display.add(pivot);
          bay.hasModel = true;
          requestFrame();
        })().catch(() => { /* The product image stays available if its GLB cannot be loaded. */ });
      }
    });
    requestFrame();
  }

  function pick(x: number, y: number) {
    if (!visible || progress > 0.975) return undefined;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return undefined;
    ndc.set((x - rect.left) / rect.width * 2 - 1, (1 - (y - rect.top) / rect.height) * 2 - 1);
    ray.setFromCamera(ndc, camera);
    const eligible = bays.filter((bay) => bay.product);
    const object = ray.intersectObjects(eligible.map((bay) => bay.hit), false)[0]?.object;
    return eligible.find((bay) => bay.hit === object)?.product;
  }

  let overlayFrame = 0;

  function requestFrame() {
    if (!frame && !overlayFrame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(render);
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

  function render() {
    frame = 0;
    if (!visible || disposed || document.hidden) return;
    const targetX = pointer ? pointer.x / canvas.clientWidth * 2 - 1 : 0;
    const targetY = pointer ? pointer.y / canvas.clientHeight * 2 - 1 : 0;
    mx += (targetX - mx) * 0.18;
    my += (targetY - my) * 0.18;
    const base = tour ? tourCameraAt(progress, camera.aspect) : cameraAt(progress);
    const blend = inspection?.amount ?? 0;
    const x = inspection?.x ?? base.lookX;
    const mix = (from: number, to: number) => from + (to - from) * blend;
    const rcWeight = ease((progress - bikeStop) / (rcStop - bikeStop));
    const frameDistance = tour ? 0 : displayWidthDistance + rcWeight * heroCamera.rcTrackFrontEdge;
    if (tour && wordmark) wordmark.position.x = base.lookX;
    camera.position.set(
      mix(base.x, x + 0.9) + mx * 0.28 * (1 - blend),
      mix(base.y, 2.55) - my * 0.16 * (1 - blend),
      mix(Math.max(base.z, frameDistance) + dolly * heroCamera.scrollDolly, 4.8) - introPush,
    );
    camera.lookAt(
      mix(base.lookX, x) + mx * 0.16 * (1 - blend),
      mix(base.lookY, 1.85) - my * 0.13 * (1 - blend),
      -1.5,
    );
    camera.updateMatrixWorld();
    const index = activeZone ?? zoneAt(progress);
    const previousHover = hover;
    if (pointer) {
      const rect = canvas.getBoundingClientRect();
      hover = pick(
        rect.left + pointer.x * rect.width / canvas.clientWidth,
        rect.top + pointer.y * rect.height / canvas.clientHeight,
      );
    } else hover = undefined;
    if (hover && hover.slug !== previousHover?.slug) events.prefetch(hover);
    canvas.classList.toggle('garage-hovering', Boolean(hover));

    let settling = Math.abs(targetX - mx) > 0.003 || Math.abs(targetY - my) > 0.003;
    bays.forEach((bay, bayIndex) => {
      const lit = bayIndex === index;
      const hovered = Boolean(hover && hover.slug === bay.product?.slug);
      const intensity = (lit ? 31 : 8) + (hovered ? 11 : 0);
      bay.light.intensity += (intensity - bay.light.intensity) * 0.19;
      bay.rail.emissiveIntensity = 0.14 + bay.light.intensity / 26;
      const opacity = hovered ? 0.95 : lit ? 0.25 : 0.06;
      bay.halo.material.opacity += (opacity - bay.halo.material.opacity) * 0.2;
      settling ||= Math.abs(intensity - bay.light.intensity) > 0.05 ||
        Math.abs(opacity - bay.halo.material.opacity) > 0.005;
    });
    renderer.render(scene, camera);
    if (!painted) {
      painted = true;
      events.ready?.();
    }
    if (settling) requestFrame();
  }

  let measured = { width: 0, height: 0, ratio: 0 };
  function resize(width = surface!.clientWidth, height = surface!.clientHeight) {
    if (disposed || !width || !height) return;
    const ratio = Math.min(view!.devicePixelRatio || 1, mobile ? tourCamera.mobileDpr : tourCamera.desktopDpr);
    if (width === measured.width && height === measured.height && ratio === measured.ratio) return;
    measured = { width, height, ratio };
    // Use the untransformed stage size, so the animated frame never changes the viewport buffer.
    renderer.setDrawingBufferSize(width, height, ratio);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Include the nearest edge of the RC display so the case fits even in a tall column.
    const horizontalSlope = Math.tan(camera.fov * Math.PI / 360) * camera.aspect;
    displayWidthDistance = heroCamera.caseHalfWidth / horizontalSlope;
    requestFrame();
  }

  const size = new ResizeObserver(([entry]) => resize(entry.contentRect.width, entry.contentRect.height));
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) requestFrame();
    else pause();
  });
  const handlers = new AbortController();
  const signal = handlers.signal;
  size.observe(surface);
  visibility.observe(surface);
  const updateResolution = () => resize(measured.width || surface.clientWidth, measured.height || surface.clientHeight);
  let resolution: MediaQueryList;
  const watchResolution = () => {
    resolution?.removeEventListener('change', watchResolution);
    resolution = view.matchMedia('(resolution: ' + view.devicePixelRatio + 'dppx)');
    resolution.addEventListener('change', watchResolution);
    updateResolution();
  };
  watchResolution();
  view.addEventListener('resize', updateResolution, { passive: true, signal });
  view.visualViewport?.addEventListener('resize', updateResolution, { passive: true, signal });
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : requestFrame(), { signal });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    // Pointer parallax is a small offset on top of the tab position and scroll dolly.
    pointer = { x: event.offsetX, y: event.offsetY };
    requestFrame();
  }, { passive: true, signal });
  canvas.addEventListener('pointerleave', () => { pointer = null; requestFrame(); }, { signal });
  canvas.addEventListener('pointerdown', (event) => {
    pressed = { x: event.clientX, y: event.clientY };
    if (event.pointerType === 'touch') {
      const product = pick(event.clientX, event.clientY);
      if (product) events.prefetch(product);
    }
  }, { passive: true, signal });
  canvas.addEventListener('click', (event) => {
    const start = pressed;
    pressed = undefined;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
    const product = pick(event.clientX, event.clientY);
    if (product) events.select(product, { x: event.clientX, y: event.clientY });
  }, { signal });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    events.failed();
  }, { signal });
  resize();

  function pause() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  return {
    prioritizeOverlay,
    productAt: pick,
    setFeatured,
    setProgress(value: number) { progress = value; requestFrame(); },
    setTourFrame(value: number, index: number) { progress = value; activeZone = index; requestFrame(); },
    setDolly(value: number) { dolly = value; requestFrame(); },
    pushIn(value: number) {
      introPush = value * .85;
      const now = performance.now();
      if (value === 0 || now - lastIntroDraw >= 48) {
        lastIntroDraw = now;
        requestFrame();
      }
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
        x: Math.max(rect.left, Math.min(rect.right, rect.left + (point.x + 1) * rect.width / 2)),
        y: Math.max(rect.top, Math.min(rect.bottom, rect.top + (1 - point.y) * rect.height / 2)),
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
      resolution.removeEventListener('change', watchResolution);
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
