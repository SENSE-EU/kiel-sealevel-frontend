import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Euler,
  Vector3,
} from 'three';
import { lookAtOrientation } from './CameraRig';
import type { SceneTheme } from './themes';

function viewpoint(
  name: string,
  eye: [number, number, number],
  target: [number, number, number],
) {
  const node = new Object3D();
  node.name = name;
  node.position.set(...eye);
  node.quaternion.copy(
    lookAtOrientation(node.position, new Vector3(...target)),
  );
  return node;
}

function marker(name: string, x: number, y: number, z: number) {
  const node = new Object3D();
  node.name = name;
  node.position.set(x, y, z);
  return node;
}

function createFloor(theme: SceneTheme) {
  const floor = new Mesh(
    new PlaneGeometry(240, 240).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: theme.floor }),
  );
  floor.name = 'seabed';
  return floor;
}

function createBlades(
  count: number,
  place: () => [number, number],
  colour: number,
) {
  const blades = new InstancedMesh(
    new BoxGeometry(0.2, 1, 0.04).translate(0, 0.5, 0),
    new MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    }),
    count,
  );
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    const [x, z] = place();
    rotation.setFromEuler(
      new Euler(
        (Math.random() - 0.5) * 0.5,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.5,
      ),
    );
    const scale = new Vector3(
      0.6 + Math.random() * 0.6,
      1 + Math.random() * 2.2,
      1,
    );
    matrix.compose(new Vector3(x, 0, z), rotation, scale);
    blades.setMatrixAt(i, matrix);
    blades.setColorAt(
      i,
      tint.setHex(colour).multiplyScalar(0.7 + Math.random() * 0.5),
    );
  }
  return blades;
}

const scatter = (width: number, depth: number) => (): [number, number] => [
  (Math.random() - 0.5) * width,
  2 - Math.random() * depth,
];

function createCasing(
  radius: number,
  length: number,
  material: MeshStandardMaterial,
) {
  return new Mesh(
    new CylinderGeometry(radius, radius, length, 8).rotateZ(Math.PI / 2),
    material,
  );
}

function createMunitions(root: Object3D) {
  const olive = new MeshStandardMaterial({
    color: 0x6b7350,
    flatShading: true,
    roughness: 1,
  });
  const dark = new MeshStandardMaterial({
    color: 0x4d5a42,
    flatShading: true,
    roughness: 1,
  });

  const mound = new Mesh(
    new SphereGeometry(2.2, 12, 5).scale(1, 0.42, 1),
    new MeshStandardMaterial({
      color: 0x6d7a60,
      flatShading: true,
      roughness: 1,
    }),
  );
  const pile = new Group();
  pile.add(mound);
  const logs: [number, number, number, number, number][] = [
    [-0.9, 1.15, 0.2, 0.5, 0.25],
    [0.3, 1.2, 0.5, -0.4, -0.18],
    [-0.2, 1.6, -0.1, 0.9, 0.4],
    [0.9, 1.05, -0.2, 0.3, -0.35],
    [-0.5, 1.75, 0.2, -0.7, -0.15],
  ];
  logs.forEach(([x, y, z, turn, tilt], i) => {
    const casing = createCasing(0.24, 1.8, i % 2 ? dark : olive);
    casing.position.set(x, y, z);
    casing.rotation.set(0, turn, tilt);
    pile.add(casing);
  });
  const stone = new Mesh(new IcosahedronGeometry(0.42, 0), dark);
  stone.position.set(2.1, 1.1, 0.2);
  pile.add(stone);

  const corroded = new Group();
  corroded.name = 'hs_2';
  const single = createCasing(
    0.3,
    1.7,
    new MeshStandardMaterial({
      color: 0x7a5c42,
      flatShading: true,
      roughness: 1,
    }),
  );
  single.position.set(-4.4, 0.32, 1.6);
  single.rotation.y = 0.6;
  corroded.add(single);

  root.add(
    pile,
    corroded,
    createBlades(16, scatter(30, 22), 0x2f7a5c),
    viewpoint('vp_1', [0, 2.3, 13.5], [0, 2.1, 0]),
    viewpoint('vp_2', [-2.4, 1.7, 3.8], [1.6, 3.4, -2]),
    viewpoint('vp_3', [5, 2.6, 7], [3, 2.2, -4]),
    viewpoint('vp_4', [-6, 3, 6], [1, 3, -2]),
    marker('hs_1', 0, 3.7, 0),
    marker('hs_3', 3.3, 3.7, 0),
    marker('hs_4', 6, 3.3, -1),
    marker('hs_5', 1.4, 5.2, -0.4),
    marker('hs_6', -3.4, 2.5, 0),
  );
}

function createPlot(x: number, z: number) {
  const plot = new Group();
  const steel = new MeshStandardMaterial({ color: 0x3d6f8a, roughness: 0.8 });
  for (let i = 0; i <= 4; i++) {
    const across = new Mesh(new BoxGeometry(0.04, 0.04, 2.1), steel);
    across.position.set(-1.3 + i * 0.65, 0.5, 0);
    const along = new Mesh(new BoxGeometry(2.6, 0.04, 0.04), steel);
    along.position.set(0, 0.5, -1.05 + (i % 4) * 0.7);
    plot.add(across, along);
  }
  plot.position.set(x, 0, z);
  return plot;
}

function createSeagrass(root: Object3D) {
  const restoration = new Group();
  restoration.name = 'hs_2';
  restoration.add(createPlot(2.6, 1.4));

  root.add(
    createBlades(170, scatter(30, 26), 0x2f9a68),
    createPlot(-2.6, 2.4),
    restoration,
    viewpoint('vp_1', [0, 2.5, 13.5], [0, 2, 0]),
    viewpoint('vp_2', [3.2, 2.2, 6], [2.6, 0.6, 1.4]),
    viewpoint('vp_3', [-5, 2.6, 7], [-1, 2, -2]),
    viewpoint('vp_4', [6, 2.8, 5], [1, 2, -3]),
    marker('hs_1', 0, 3.3, 0),
    marker('hs_3', -3.3, 3.6, 0),
    marker('hs_4', 4, 3, 0),
    marker('hs_5', -3.9, 3.2, 0.2),
    marker('hs_6', 0, 1.9, 2),
  );
}

function createReef(root: Object3D) {
  const stone = new MeshStandardMaterial({
    color: 0x6f9a9a,
    flatShading: true,
    roughness: 1,
  });
  const boulders: [number, number, number, number][] = [
    [-2.6, 1, 2.6, 1.5],
    [-7, 0.9, 0.5, 1.5],
    [1.6, 0.5, 2.8, 0.7],
    [3.6, 0.9, -2.5, 1.1],
    [7, 1.2, 0, 1.5],
    [5.6, 1.1, 5.4, 1.9],
    [-0.8, 0.5, -4, 0.7],
  ];
  boulders.forEach(([x, y, z, size]) => {
    const boulder = new Mesh(new IcosahedronGeometry(size, 0), stone);
    boulder.position.set(x, y, z);
    boulder.rotation.set(x, z, y);
    root.add(boulder);
  });

  const erratic = new Mesh(new IcosahedronGeometry(1.2, 0), stone);
  erratic.name = 'hs_2';
  erratic.position.set(-4, 1, -3);

  root.add(
    erratic,
    createBlades(26, scatter(26, 20), 0x2f7a5c),
    viewpoint('vp_1', [0, 2.3, 13.5], [0, 2.3, 0]),
    viewpoint('vp_2', [-2, 2, 2], [-4, 1.4, -3]),
    viewpoint('vp_3', [3, 1.8, 7], [6, 0.8, -3]),
    viewpoint('vp_4', [-5, 2.5, 6], [0, 1, -3]),
    marker('hs_1', 0, 3.7, 0),
    marker('hs_3', 3.4, 3.2, 0),
    marker('hs_4', -4.2, 3.5, 0),
    marker('hs_5', 1.9, 3.9, 0),
    marker('hs_6', 0, 2.9, 0),
  );
}

/**
 * Stand-in until the artist's GLBs arrive, and the fallback if one fails to load. It exposes the same
 * named anchors a real model must, so it exercises the whole CMS-to-scene contract.
 */
export function createPlaceholderScene(theme: SceneTheme): Object3D {
  const root = new Group();
  root.name = `placeholder_${theme.kind}`;
  root.add(createFloor(theme));
  if (theme.kind === 'munitions') createMunitions(root);
  else if (theme.kind === 'seagrass') createSeagrass(root);
  else createReef(root);
  return root;
}
