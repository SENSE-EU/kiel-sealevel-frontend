import type { WebGLRenderer } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

/** A glTF loader for any of the usual compression options (Draco or meshopt geometry, KTX2 textures). */
export function createLoader(renderer: WebGLRenderer) {
  const draco = new DRACOLoader();
  const ktx2 = new KTX2Loader().detectSupport(renderer);
  const loader = new GLTFLoader()
    .setDRACOLoader(draco)
    .setKTX2Loader(ktx2)
    .setMeshoptDecoder(MeshoptDecoder);
  return {
    loader,
    dispose() {
      draco.dispose();
      ktx2.dispose();
    },
  };
}

/** Loads one GLB. */
export async function loadModel(
  url: string,
  renderer: WebGLRenderer,
  onProgress: (fraction: number) => void,
) {
  const { loader, dispose } = createLoader(renderer);
  try {
    const gltf = await loader.loadAsync(url, (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    return gltf.scene;
  } finally {
    dispose();
  }
}
