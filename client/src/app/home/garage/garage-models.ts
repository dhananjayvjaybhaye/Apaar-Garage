import {
  Box3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import { responsiveImage } from '../../ui/responsive-image';
import { disposeModels } from '../../car-viewer/three-resources';
import type { Product } from '../../catalog/product';
import { garageZoneFor, type GarageZone } from './garage-path';

export interface GarageBay {
  display: Group;
  hit: Mesh;
  halo: Mesh<RingGeometry, MeshBasicMaterial>;
  light: PointLight;
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
) {
  const loader = new TextureLoader();
  const center = new Vector3();
  function clear(display: Group) {
    disposeModels([display]);
    display.clear();
  }

  let active = 0;
  function setFeatured(products: readonly Product[]) {
    zoneOptions.forEach(({ category }, index) => {
      const product = products.find((entry) => garageZoneFor(entry) === category);
      const bay = bays[index];
      if (
        bay.product?.slug === product?.slug &&
        bay.product?.images[0] === product?.images[0] &&
        bay.product?.glbUrl === product?.glbUrl
      ) {
        bay.product = product;
        return;
      }

      bay.request?.abort();
      clear(bay.display);
      bay.product = product;
      bay.hasModel = false;
      bay.loadingModel = false;
      if (!product) return;
      const request = new AbortController();
      bay.request = request;
      const live = () => available() && !request.signal.aborted;

      if (product.images[0]) {
        loader.load(
          responsiveImage(product.images[0])?.split(' ')[0] ?? product.images[0],
          (texture) => {
            if (!live() || bay.hasModel) {
              texture.dispose();
              return;
            }
            texture.colorSpace = SRGBColorSpace;
            const image = new Mesh(
              new PlaneGeometry(2.62, 1.94),
              new MeshBasicMaterial({ map: texture, toneMapped: false }),
            );
            image.position.set(0, 1.02, 0.19);
            bay.display.add(image);
            requestFrame();
          },
          undefined,
          () => {},
        );
      }
    });
    loadActiveModel();
    requestFrame();
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
    const model = await parseGltfModel(buffer, new URL('.', response.url).href);
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
      loadActiveModel();
    },
  };
}
