import { BufferGeometry, Float32BufferAttribute } from 'three';
import { expect, it } from 'vitest';
import { closeHerringTail } from './vegetation';

it('closes the herring tail once and preserves the existing vertices', () => {
  const geometry = new BufferGeometry();
  const vertices = [
    -0.029, 0.001, 0, -0.029, -0.001, 0, -0.038, 0.0014, 0, -0.038, -0.0014, 0,
    -0.046, 0.006, 0, -0.046, -0.006, 0,
  ];
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute(
    'normal',
    new Float32BufferAttribute(
      vertices.map(() => 0),
      3,
    ),
  );
  geometry.setIndex([0, 2, 4, 1, 3, 5]);
  const original = Array.from(geometry.getAttribute('position').array);

  closeHerringTail(geometry);
  closeHerringTail(geometry);

  expect(Array.from(geometry.getIndex()!.array)).toEqual([
    0, 2, 4, 1, 3, 5, 6, 7, 8, 6, 8, 9,
  ]);
  expect(
    Array.from(
      geometry.getAttribute('position').array.slice(0, original.length),
    ),
  ).toEqual(original);
  expect(geometry.getAttribute('normal').getZ(6)).toBe(1);
  geometry.dispose();
});
