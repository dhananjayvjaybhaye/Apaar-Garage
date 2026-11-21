import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function parseGltfModel(buffer: ArrayBuffer, basePath: string) {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, basePath);
}
