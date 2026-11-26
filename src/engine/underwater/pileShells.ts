import { InstancedMesh, Matrix4, Mesh, type Object3D } from 'three';

/** Batch the static pile shells within one chapter while retaining their authored transforms. */
export function batchPileShells(parent: Object3D, objects: Object3D[]) {
  const groups = new Map<string, Mesh[]>();
  const toLocal = new Matrix4().copy(parent.matrixWorld).invert();
  const parentDeterminant = parent.matrixWorld.determinant();
  for (const object of objects) {
    if (
      !(object instanceof Mesh) ||
      object.type !== 'Mesh' ||
      !/^PROP_Pile_Shell_\d+$/.test(object.name) ||
      object.children.length ||
      object.morphTargetInfluences ||
      Array.isArray(object.material) ||
      object.matrixWorld.determinant() * parentDeterminant <= 0
    )
      continue;
    const key = [
      object.geometry.id,
      object.material.id,
      object.layers.mask,
      object.renderOrder,
      object.castShadow,
      object.receiveShadow,
    ].join(':');
    const group = groups.get(key);
    if (group) group.push(object);
    else groups.set(key, [object]);
  }

  const batched = new Set<Object3D>();
  const batches: InstancedMesh[] = [];
  const matrix = new Matrix4();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0]!;
    const batch = new InstancedMesh(
      first.geometry,
      first.material,
      group.length,
    );
    batch.name = `${first.name}_instances`;
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.layers.mask = first.layers.mask;
    batch.renderOrder = first.renderOrder;
    group.forEach((mesh, index) => {
      batch.setMatrixAt(
        index,
        matrix.multiplyMatrices(toLocal, mesh.matrixWorld),
      );
      mesh.removeFromParent();
      batched.add(mesh);
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingSphere();
    parent.add(batch);
    batches.push(batch);
  }
  return [...objects.filter((object) => !batched.has(object)), ...batches];
}
