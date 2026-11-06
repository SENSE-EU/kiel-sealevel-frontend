import type { Material, Mesh, Object3D, Texture } from 'three';

/** The agreed phone budget. Exceeding it only warns, so a heavy model is caught but never breaks the site. */
export const BUDGET = {
  fileBytes: 10 * 1024 * 1024,
  triangles: 100_000,
  textureSize: 2048,
};

export function checkBudget(root: Object3D, fileBytes: number | undefined) {
  let triangles = 0;
  let largestTexture = 0;

  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const { index, attributes } = mesh.geometry;
    triangles += (index ? index.count : attributes.position!.count) / 3;

    for (const material of [mesh.material].flat() as Material[]) {
      for (const value of Object.values(material)) {
        const texture = value as Texture | null;
        if (texture?.isTexture) {
          const { width = 0, height = 0 } = (texture.image ?? {}) as {
            width?: number;
            height?: number;
          };
          largestTexture = Math.max(largestTexture, width, height);
        }
      }
    }
  });

  const over: string[] = [];
  if (fileBytes !== undefined && fileBytes > BUDGET.fileBytes)
    over.push(`file ${fileBytes} bytes`);
  if (triangles > BUDGET.triangles)
    over.push(`${Math.round(triangles)} triangles`);
  if (largestTexture > BUDGET.textureSize)
    over.push(`${largestTexture}px texture`);
  if (over.length > 0)
    console.warn(`[scene] Model is over the phone budget: ${over.join(', ')}`);
}
