import {
  BufferGeometry,
  InstancedMesh,
  Line,
  Material,
  Mesh,
  Object3D,
  PMREMGenerator,
  Points,
  Skeleton,
  SkinnedMesh,
  Texture,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createEnvironment(renderer: WebGLRenderer) {
  const room = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  try {
    return pmrem.fromScene(room, 0.06);
  } finally {
    room.dispose();
    pmrem.dispose();
  }
}

export function disposeModels(roots: Object3D[]) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const skeletons = new Set<Skeleton>();
  const textures = new Set<Texture>();
  const bitmaps = new Set<ImageBitmap>();

  for (const root of roots) {
    root.traverse((object) => {
      if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
      if (object instanceof InstancedMesh) object.dispose();
      if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;

      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
      }
    });
  }

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) textures.add(value);
    }
    material.dispose();
  }

  for (const texture of textures) {
    const image: unknown = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) bitmaps.add(image);
    texture.dispose();
  }

  for (const bitmap of bitmaps) bitmap.close();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}
