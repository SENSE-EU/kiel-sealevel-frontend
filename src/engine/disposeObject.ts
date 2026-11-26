import type {
  InstancedMesh,
  Material,
  Mesh,
  Object3D,
  Points,
  Texture,
} from 'three';

export function disposeObject(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh | Points;
    if (!mesh.geometry) return;
    const instanced = mesh as InstancedMesh;
    if (instanced.isInstancedMesh) instanced.dispose();
    mesh.geometry.dispose();
    for (const material of [mesh.material].flat() as Material[]) {
      for (const value of Object.values(material)) {
        if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
      }
      material.dispose();
    }
  });
}
