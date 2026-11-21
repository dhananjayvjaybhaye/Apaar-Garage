import {
  Box3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
  type Texture,
  TextureLoader,
  Vector3,
} from 'three';
import { responsiveImage } from '../../ui/responsive-image';
import { disposeModels } from '../../car-viewer/three-resources';
import type { Product } from '../../catalog/product';
import { garageZoneFor, type GarageZone } from './garage-path';
import { limitBenchTexture, makeBenchCard, rcBenchFallback } from './garage-bench-card';
import { benchMedia } from '../hero.config';

export interface GarageBay {
  display: Group;
  hit: Mesh;
  halo: Mesh<RingGeometry, MeshBasicMaterial>;
  light?: PointLight;
  lightIntensity: number;
  rail: MeshStandardMaterial;
  product?: Product;
  request?: AbortController;
  hasModel: boolean;
  loadingModel?: boolean;
}

export function createGarageModels(
  bays: GarageBay[],
  zoneOptions: ReadonlyArray<{ category: GarageZone }>,
  available: () => boolean,
  requestFrame: () => void,
  document: Document,
  compact: boolean,
) {
  const loader = new TextureLoader();
  const center = new Vector3();
  const view = document.defaultView;
  const photoSize = compact ? benchMedia.mobilePhotoSize : benchMedia.desktopPhotoSize;
  const pendingPhotos = new Map<number, () => void>();
  let cancelIdle: (() => void) | undefined;
  function clear(display: Group) {
    disposeModels([display]);
    display.clear();
  }

  let active = 0;
  const rcBay = zoneOptions.findIndex(({ category }) => category === 'rc');
  if (rcBay >= 0) bays[rcBay].display.add(rcBenchFallback(document));

  function setFeatured(products: readonly Product[]) {
    zoneOptions.forEach(({ category }, index) => {
      const product = products.find((entry) => garageZoneFor(entry) === category);
      const bay = bays[index];
      if (
        bay.product?.slug === product?.slug &&
        bay.product?.images.join('\n') === product?.images.join('\n') &&
        bay.product?.glbUrl === product?.glbUrl
      ) {
        bay.product = product;
        return;
      }

      bay.request?.abort();
      pendingPhotos.delete(index);
      clear(bay.display);
      bay.product = product;
      bay.hasModel = false;
      bay.loadingModel = false;
      if (index === rcBay) bay.display.add(rcBenchFallback(document, product?.name));
      if (!product) return;
      const request = new AbortController();
      bay.request = request;
      const live = () => available() && !request.signal.aborted;
      const photos = [
        ...new Set(
          product.images.flatMap((source) => {
            const small = responsiveImage(source)?.split(' ')[0];
            return small ? [small, source] : [source];
          }),
        ),
      ];

      function loadPhoto(index: number) {
        const source = photos[index];
        if (!source || !live() || bay.hasModel) return;
        loader.load(
          source,
          (texture) => void installPhoto(texture).catch(() => loadPhoto(index + 1)),
          undefined,
          () => loadPhoto(index + 1),
        );
      }

      async function installPhoto(source: Texture) {
        await nextFrame(request.signal);
        if (!live() || bay.hasModel) {
          source.dispose();
          return;
        }
        let texture: Texture;
        try {
          texture = limitBenchTexture(document, source, photoSize);
        } catch (error) {
          source.dispose();
          throw error;
        }
        clear(bay.display);
        bay.display.add(makeBenchCard(texture));
        requestFrame();
      }
      pendingPhotos.set(index, () => loadPhoto(0));
    });
    loadPhotoAt(active);
    loadActiveModel();
    scheduleOtherPhotos();
    requestFrame();
  }

  function nextFrame(signal: AbortSignal) {
    if (!view || signal.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const finish = () => {
        signal.removeEventListener('abort', cancel);
        resolve();
      };
      const frame = view.requestAnimationFrame(finish);
      const cancel = () => {
        view.cancelAnimationFrame(frame);
        finish();
      };
      signal.addEventListener('abort', cancel, { once: true });
    });
  }

  function loadPhotoAt(index: number) {
    const load = pendingPhotos.get(index);
    pendingPhotos.delete(index);
    load?.();
  }

  function scheduleOtherPhotos() {
    if (cancelIdle || !pendingPhotos.size || !view) return;
    const next = () => {
      cancelIdle = undefined;
      const index = pendingPhotos.keys().next().value;
      if (index === undefined) return;
      loadPhotoAt(index);
      scheduleOtherPhotos();
    };
    if (typeof view.requestIdleCallback === 'function') {
      const id = view.requestIdleCallback(next, { timeout: benchMedia.idleTimeout });
      cancelIdle = () => view.cancelIdleCallback(id);
    } else {
      const id = view.setTimeout(next, benchMedia.timerFallback);
      cancelIdle = () => view.clearTimeout(id);
    }
  }

  function loadActiveModel() {
    const bay = bays[active];
    const url = bay?.product?.glbUrl;
    const request = bay?.request;
    if (!url || !request || bay.hasModel || bay.loadingModel) return;
    bay.loadingModel = true;
    const live = () => available() && !request.signal.aborted;
    void showModel(bay, url, request, live)
      .catch(() => {
        // Keep the photo on the stand if this model is unavailable.
      })
      .finally(() => {
        if (live()) bay.loadingModel = false;
      });
  }

  async function showModel(
    bay: GarageBay,
    modelUrl: string,
    request: AbortController,
    live: () => boolean,
  ) {
    const response = await fetch(modelUrl, { signal: request.signal });
    if (!response.ok) return;
    const buffer = await response.arrayBuffer();
    if (!live()) return;
    const { parseGltfModel } = await import('../../car-viewer/gltf-model');
    await nextFrame(request.signal);
    if (!live()) return;
    const model = await parseGltfModel(buffer, new URL('.', response.url).href);
    await nextFrame(request.signal);
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
  }

  return {
    setFeatured,
    select(index: number) {
      if (active === index) return;
      active = index;
      loadPhotoAt(active);
      loadActiveModel();
    },
    destroy() {
      cancelIdle?.();
      pendingPhotos.clear();
      for (const bay of bays) bay.request?.abort();
    },
  };
}
