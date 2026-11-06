import type { WebGLRenderer } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

/** Loads a GLB compressed with any of the usual options (Draco or meshopt geometry, KTX2 textures). */
export async function loadModel(
  url: string,
  renderer: WebGLRenderer,
  onProgress: (fraction: number) => void,
) {
  const draco = new DRACOLoader();
  const ktx2 = new KTX2Loader().detectSupport(renderer);
  const loader = new GLTFLoader()
    .setDRACOLoader(draco)
    .setKTX2Loader(ktx2)
    .setMeshoptDecoder(MeshoptDecoder);

  try {
    const gltf = await loader.loadAsync(url, (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    return gltf.scene;
  } finally {
    draco.dispose();
    ktx2.dispose();
  }
}
