import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { disposeObject } from './disposeObject';
import type { SceneTheme } from './themes';

const css = (hex: number) => `#${new Color(hex).getHexString()}`;

function verticalGradient(top: number, bottom: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, css(top));
  gradient.addColorStop(1, css(bottom));
  context.fillStyle = gradient;
  context.fillRect(0, 0, 2, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function pointCloud(
  count: number,
  place: (i: number) => [number, number, number],
  material: PointsMaterial,
) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) positions.set(place(i), i * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return new Points(geometry, material);
}

function createLightShafts(theme: SceneTheme) {
  const shafts = new Group();
  const material = new MeshBasicMaterial({
    color: theme.sun,
    transparent: true,
    opacity: 0.05,
    side: DoubleSide,
    depthWrite: false,
    fog: false,
    blending: AdditiveBlending,
  });
  const geometry = new PlaneGeometry(1, 60);
  for (let i = 0; i < 7; i++) {
    const shaft = new Mesh(geometry, material);
    shaft.position.set(
      -24 + i * 8 + Math.random() * 3,
      18,
      -16 - Math.random() * 8,
    );
    shaft.scale.x = 3 + Math.random() * 5;
    shaft.rotation.z = -0.22 + Math.random() * 0.1;
    shafts.add(shaft);
  }
  return shafts;
}

function createFish(theme: SceneTheme) {
  const body = new OctahedronGeometry(1, 0).scale(0.55, 0.18, 0.14);
  const tail = new ConeGeometry(0.2, 0.4, 3)
    .rotateZ(-Math.PI / 2)
    .translate(-0.68, 0, 0)
    .toNonIndexed();
  const fin = new ConeGeometry(0.1, 0.24, 3)
    .translate(0, 0.2, 0)
    .toNonIndexed();
  const geometry = mergeGeometries([body, tail, fin])!;
  geometry.computeVertexNormals();

  const swimmers = Array.from({ length: 14 }, () => ({
    radius: 6 + Math.random() * 7,
    speed: (0.06 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1),
    phase: Math.random() * Math.PI * 2,
    height: 2.2 + Math.random() * 4,
    scale: 0.35 + Math.random() * 0.45,
  }));
  const mesh = new InstancedMesh(
    geometry,
    new MeshStandardMaterial({
      color: theme.fish,
      flatShading: true,
      roughness: 0.5,
    }),
    swimmers.length,
  );
  mesh.frustumCulled = false;

  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const scale = new Vector3();

  return {
    mesh,
    update(seconds: number) {
      swimmers.forEach((swimmer, i) => {
        const angle = swimmer.phase + seconds * swimmer.speed;
        position.set(
          Math.cos(angle) * swimmer.radius,
          swimmer.height + Math.sin(angle * 3) * 0.3,
          -5 + Math.sin(angle) * swimmer.radius * 0.7,
        );
        rotation.setFromAxisAngle(
          up,
          swimmer.speed > 0 ? -angle - Math.PI / 2 : -angle + Math.PI / 2,
        );
        matrix.compose(position, rotation, scale.setScalar(swimmer.scale));
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function createBubbles() {
  const count = 110;
  const height = 13;
  const seeds = Array.from({ length: count }, () => Math.random());
  const bubbles = pointCloud(
    count,
    () => [0, 0, 0],
    new PointsMaterial({
      size: 0.09,
      color: 0xd5e6ea,
      transparent: true,
      opacity: 0.55,
    }),
  );
  const positions = bubbles.geometry.attributes.position!;
  bubbles.frustumCulled = false;
  return {
    bubbles,
    update(seconds: number) {
      seeds.forEach((seed, i) => {
        const y = ((seed * height + seconds * (0.5 + seed * 0.3)) % height) + 1;
        const spread = 0.35 + y * 0.09;
        const swirl = seed * 40 + y * 0.5;
        positions.setXYZ(
          i,
          Math.cos(swirl) * spread,
          y,
          Math.sin(swirl) * spread,
        );
      });
      positions.needsUpdate = true;
    },
  };
}

/** Murky water, light from above, drifting particles, fish, and bubbles over the munitions pile. */
export function createEnvironment(scene: Scene, theme: SceneTheme) {
  const background = verticalGradient(theme.skyTop, theme.skyBottom);
  scene.background = background;
  scene.fog = new FogExp2(theme.fog, 0.05);

  const group = new Group();
  const sun = new DirectionalLight(theme.sun, 1.8);
  sun.position.set(2, 20, 6);
  const fish = createFish(theme);
  const particles = pointCloud(
    260,
    () => [
      (Math.random() - 0.5) * 40,
      Math.random() * 14,
      (Math.random() - 0.5) * 34,
    ],
    new PointsMaterial({
      size: 0.045,
      color: 0xd8efe4,
      transparent: true,
      opacity: 0.5,
    }),
  );
  const bubbles = theme.kind === 'munitions' ? createBubbles() : null;

  group.add(
    new HemisphereLight(theme.sun, theme.floor, 1.5),
    sun,
    createLightShafts(theme),
    fish.mesh,
    particles,
  );
  if (bubbles) group.add(bubbles.bubbles);
  scene.add(group);

  return {
    update(seconds: number) {
      particles.rotation.y = seconds * 0.008;
      particles.position.y = Math.sin(seconds * 0.15) * 0.25;
      fish.update(seconds);
      bubbles?.update(seconds);
    },
    dispose() {
      scene.remove(group);
      disposeObject(group);
      background.dispose();
    },
  };
}

/** Slow drift that keeps a held viewpoint feeling underwater. Small enough that pins stay easy to tap. */
export function swayOffset(seconds: number, target: Vector3) {
  return target.set(
    Math.sin(seconds * 0.31) * 0.12,
    Math.sin(seconds * 0.43) * 0.07,
    MathUtils.clamp(Math.cos(seconds * 0.23) * 0.1, -0.1, 0.1),
  );
}
