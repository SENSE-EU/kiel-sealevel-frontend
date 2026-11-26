import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { expect, it } from 'vitest';
import { batchPileShells } from './pileShells';

it('batches only matching pile shells and preserves their world transforms', () => {
  const scene = new Group();
  scene.position.set(12, 3, 0);
  const pile = new Group();
  pile.rotation.y = Math.PI / 5;
  scene.add(pile);
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const shell = (name: string, x: number, parent = pile) => {
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.position.x = x;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const a = shell('PROP_Pile_Shell_02', 1);
  const b = shell('PROP_Pile_Shell_03', 2);
  b.scale.setScalar(0.5);
  const closeUp = shell('PROP_Shell_155mm_01', 3);
  const mirrored = shell('PROP_Pile_Shell_04', 4);
  mirrored.scale.x = -1;
  const otherChapter = shell('PROP_Pile_Shell_05', 5, scene);
  scene.updateMatrixWorld(true);
  const expected = [a.matrixWorld.clone(), b.matrixWorld.clone()];

  const objects = batchPileShells(scene, [a, b, closeUp, mirrored]);
  const [batch] = objects.filter((object) => object instanceof InstancedMesh);
  expect(objects).toEqual([closeUp, mirrored, batch]);
  expect(batch?.count).toBe(2);
  expect(batch?.castShadow).toBe(true);
  expect(batch?.receiveShadow).toBe(true);
  expect(batch?.boundingSphere).not.toBeNull();
  expect(a.parent).toBeNull();
  expect(b.parent).toBeNull();
  expect(scene.getObjectByName(otherChapter.name)).toBe(otherChapter);
  expect(scene.getObjectByName(closeUp.name)).toBe(closeUp);
  scene.updateMatrixWorld(true);
  for (const [i, matrix] of expected.entries()) {
    const actual = new Matrix4();
    batch!.getMatrixAt(i, actual);
    actual.premultiply(batch!.matrixWorld);
    actual.elements.forEach((value, j) =>
      expect(value).toBeCloseTo(matrix.elements[j]!),
    );
  }
});
