import {
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  NoColorSpace,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Mesh,
  type Object3D,
} from 'three';
import { waterize, type WaterMaterialData, type WaterUniforms } from './water';

/**
 * The instanced plants, mussel beds and fish of the 3D team's scenes, ported from their viewer
 * (25 Nov 2026). The textures are drawn into canvases at load, so there are no image files.
 */

export interface VegetationData {
  sway: Record<string, number>;
  fauna?: Record<string, { school?: boolean; length?: number }>;
  /** World matrices per prototype (Y-up, column-major), 16 numbers each. */
  instances: Record<string, number[]>;
}

/** Thin cards and branches skip the shadow pass; fish too, as they move. */
const NO_SHADOW = /^VEG_(Eelgrass|Fuzz|Turf|RedBush)/;

const seeded = (seed: number) => {
  let r = seed;
  return () => (r = (r * 16807) % 2147483647) / 2147483647;
};

function canvasTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Hydroid turf strands: two tufts side by side, base at the bottom of the card. */
function makeFuzzTexture(size = 256, seed = 7) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const rnd = seeded(seed);
  const tones = [
    '#7d7150',
    '#8a7d58',
    '#6c6446',
    '#958660',
    '#66664a',
    '#9c8d66',
  ];
  g.lineCap = 'round';
  for (let half = 0; half < 2; half++) {
    const cx = size * (0.25 + 0.5 * half);
    for (let i = 0; i < 70; i++) {
      const x0 = cx + (rnd() - 0.5) * size * 0.16;
      const length = size * (0.35 + 0.6 * rnd());
      const bend = (rnd() - 0.5) * size * 0.16;
      g.strokeStyle = tones[Math.floor(rnd() * tones.length)]!;
      let px = x0;
      let py = size;
      for (let k = 1; k <= 10; k++) {
        const t = k / 10;
        const x = x0 + bend * t * t + Math.sin(t * 6 + i) * 2.0;
        const y = size - length * t;
        g.lineWidth = 1.6 * (1 - t) + 0.5;
        g.globalAlpha = 1.0 - 0.55 * t;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(x, y);
        g.stroke();
        if (k > 3 && rnd() < 0.18) {
          const branch = size * 0.06 * rnd();
          const dir = rnd() < 0.5 ? -1 : 1;
          g.lineWidth = 0.6;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + dir * branch, y - branch * 0.7);
          g.stroke();
        }
        px = x;
        py = y;
      }
    }
  }
  return canvasTexture(canvas);
}

/** Red-brown algal turf tufts: bushy, much-branched reds a few cm high, the odd orange fleck. */
function makeTurfTexture(size = 256, seed = 23) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const rnd = seeded(seed);
  const tones = [
    '#45201a',
    '#52261d',
    '#391c16',
    '#5f3527',
    '#462a1b',
    '#2f2118',
  ];
  g.lineCap = 'round';
  const twig = (
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    depth: number,
  ) => {
    const x2 = x + Math.sin(angle) * length;
    const y2 = y - Math.cos(angle) * length;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
    if (depth > 0) {
      const n = 2 + (rnd() < 0.35 ? 1 : 0);
      for (let k = 0; k < n; k++)
        twig(
          x2,
          y2,
          angle + (rnd() - 0.5) * 1.3,
          length * (0.62 + 0.2 * rnd()),
          width * 0.72,
          depth - 1,
        );
    } else if (rnd() < 0.07) {
      g.fillStyle = '#c0753a';
      g.beginPath();
      g.arc(x2, y2, 1.6 + rnd() * 1.4, 0, 6.283);
      g.fill();
    }
  };
  for (let half = 0; half < 2; half++) {
    const cx = size * (0.25 + 0.5 * half);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = tones[Math.floor(rnd() * tones.length)]!;
      g.globalAlpha = 0.8 + 0.2 * rnd();
      twig(
        cx + (rnd() - 0.5) * size * 0.2,
        size,
        (rnd() - 0.5) * 0.7,
        size * (0.12 + 0.1 * rnd()),
        2.4,
        4,
      );
    }
  }
  return canvasTexture(canvas);
}

/**
 * Blue-mussel shells: U runs from the umbo to the margin, so growth lines run along constant U. Fine faint
 * growth lines, three darker growth checks, a brownish rim, a worn paler umbo; a normal map for the relief.
 */
function makeMusselTextures(w = 256, h = 64, seed = 11) {
  const rnd = seeded(seed);
  const height = new Float32Array(w * h);
  const albedo = new Float32Array(w * h);
  const jitter = Array.from({ length: 40 }, () => rnd());
  const scratch = Array.from({ length: h }, () => rnd());
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      const ph =
        44 * Math.pow(u, 0.7) + 0.15 * Math.sin(v * Math.PI * 4 + u * 9);
      const f = ph - Math.floor(ph);
      const fine = Math.exp(-Math.pow((f - 0.05) / 0.12, 2));
      let checks = 0;
      for (const c of [
        0.38 + 0.06 * jitter[1]!,
        0.62 + 0.05 * jitter[2]!,
        0.84 + 0.04 * jitter[3]!,
      ])
        checks += Math.exp(-Math.pow((u - c) / 0.012, 2));
      const rim = Math.max(0, (u - 0.93) / 0.07);
      const umbo = Math.max(0, 1 - u / 0.16);
      height[y * w + x] =
        -0.12 * fine - 0.35 * checks + 0.02 * (scratch[y]! - 0.5);
      albedo[y * w + x] =
        1.0 -
        0.07 * fine -
        0.22 * checks +
        0.18 * umbo -
        0.08 * rim +
        0.03 * (scratch[y]! - 0.5);
    }
  const make = (
    fill: (i: number, data: Uint8ClampedArray, o: number) => void,
    srgb: boolean,
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d')!;
    const image = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) fill(i, image.data, i * 4);
    g.putImageData(image, 0, 0);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  const colour = make((i, d, o) => {
    const a = Math.max(0, Math.min(1, albedo[i]!)) * 255;
    d[o] = d[o + 1] = d[o + 2] = a;
    d[o + 3] = 255;
  }, true);
  const n = new Vector3();
  const normal = make((i, d, o) => {
    const x = i % w;
    const y = (i / w) | 0;
    const du =
      height[y * w + Math.min(w - 1, x + 1)]! -
      height[y * w + Math.max(0, x - 1)]!;
    const dv =
      height[((y + 1) % h) * w + x]! - height[((y - 1 + h) % h) * w + x]!;
    n.set(-du * 2.2, -dv * 2.2, 1).normalize();
    d[o] = (n.x * 0.5 + 0.5) * 255;
    d[o + 1] = (n.y * 0.5 + 0.5) * 255;
    d[o + 2] = (n.z * 0.5 + 0.5) * 255;
    d[o + 3] = 255;
  }, false);
  return { colour, normal };
}

const hash = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

interface Fish {
  mesh: InstancedMesh;
  base: Matrix4[];
  school: boolean;
}

/** The background school loops round the site on an ellipse at the edge of visibility. */
const SCHOOL = { cx: 0.4, cz: 0.3, a: 3.7, b: 3.0, y: 1.35, speed: 0.38 };

/** Close the gap between the tail lobes on the shipped herring mesh. */
export function closeHerringTail(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  if (!position || !index) return;
  const pick = (min: number, max: number, sign: number) => {
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      if (
        x > min &&
        x < max &&
        Math.abs(position.getZ(i)) < 1e-4 &&
        Math.sign(y) === sign &&
        Math.abs(y) < 0.003
      )
        return i;
    }
    return -1;
  };
  const stem = -0.32 * 0.09;
  const upper = pick(stem - 0.002, stem + 0.002, 1);
  const lower = pick(stem - 0.002, stem + 0.002, -1);
  const forkUpper = pick(stem - 0.0108, stem - 0.0072, 1);
  const forkLower = pick(stem - 0.0108, stem - 0.0072, -1);
  const corners = [upper, forkUpper, forkLower, lower];
  if (corners.includes(-1)) return;

  const xs = position.getX(upper);
  const xe = position.getX(forkUpper);
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    if (x > xe && x < xs && Math.abs(y) < 0.0009 && Math.abs(z) < 1e-4) return;
  }

  // Keep separate vertices so the two lobes' opposing normals don't cancel at the join.
  const start = position.count;
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const count = attribute.count + corners.length;
    const ArrayType = attribute.array.constructor as typeof Float32Array;
    const extended = new BufferAttribute(
      new ArrayType(count * attribute.itemSize),
      attribute.itemSize,
      attribute.normalized,
    );
    for (let i = 0; i < count; i++) {
      for (let component = 0; component < attribute.itemSize; component++) {
        const value =
          i >= start && name === 'normal'
            ? Number(component === 2)
            : attribute.getComponent(
                i < start ? i : corners[i - start]!,
                component,
              );
        extended.setComponent(i, component, value);
      }
    }
    geometry.setAttribute(name, extended);
  }
  geometry.setIndex([
    ...index.array,
    start,
    start + 1,
    start + 2,
    start,
    start + 2,
    start + 3,
  ]);
}

/**
 * Builds the vegetation: one InstancedMesh per species and chapter, so a hidden chapter costs nothing. The
 * fish school swims wherever the active chapter is, so it stays one batch.
 */
export function createVegetation(
  prototypes: Object3D,
  data: VegetationData,
  uniforms: WaterUniforms,
  chapterOf: (point: Vector3) => { id: string; objects: Object3D[] },
) {
  const fuzz = makeFuzzTexture();
  const turf = makeTurfTexture();
  const mussel = makeMusselTextures();
  const disposables: { dispose(): void }[] = [
    fuzz,
    turf,
    mussel.colour,
    mussel.normal,
  ];
  const group = new Group();
  group.name = 'vegetation';
  const fish: Fish[] = [];
  const matrix = new Matrix4();
  const position = new Vector3();

  for (const [name, matrices] of Object.entries(data.instances)) {
    const prototype = prototypes.getObjectByName(name) as Mesh | undefined;
    if (!prototype?.isMesh) {
      console.warn(`[scene] Vegetation prototype ${name} is missing`);
      continue;
    }
    const fauna = data.fauna?.[name];
    if (fauna?.school) closeHerringTail(prototype.geometry);
    let material: MeshStandardMaterial;
    if (name.startsWith('VEG_Fuzz') || name.startsWith('VEG_Turf')) {
      const isTurf = name.startsWith('VEG_Turf');
      material = new MeshStandardMaterial({
        map: isTurf ? turf : fuzz,
        alphaTest: 0.35,
        alphaToCoverage: true,
        side: DoubleSide,
        roughness: isTurf ? 0.95 : 0.9,
        metalness: 0,
      });
      waterize(material, uniforms, { sway: isTurf ? 4.0 : 6.0 });
    } else {
      material = (prototype.material as MeshStandardMaterial).clone();
      material.side = DoubleSide;
      if (fauna?.school) {
        // Silver flanks glint as they turn.
        material.metalness = 0.7;
        material.roughness = 0.22;
        material.envMapIntensity = 2.6;
      }
      if (name.startsWith('VEG_Mussel') && prototype.geometry.attributes.uv) {
        material.map = mussel.colour;
        material.normalMap = mussel.normal;
        material.normalScale.set(0.45, 0.45);
        material.color.setRGB(1.12, 1.14, 1.3);
        material.roughness = 0.62;
        // In the plume, mussels glow and pulse: they are what TNT uptake is monitored in.
        (material.userData as WaterMaterialData).plumeK = 2.4;
      }
      waterize(material, uniforms, {
        sway: data.sway[name] ?? 0,
        wiggle: fauna ? (fauna.school ? 0.006 : 0.0035) : 0,
        fishLength: fauna?.length ?? 0.055,
      });
    }
    disposables.push(material);

    const groups = new Map<
      string,
      { objects: Object3D[] | null; indices: number[] }
    >();
    for (let i = 0; i < matrices.length / 16; i++) {
      position.fromArray(matrices, i * 16 + 12);
      const chapter = fauna?.school ? null : chapterOf(position);
      const key = chapter?.id ?? 'all';
      const entry = groups.get(key) ?? {
        objects: chapter?.objects ?? null,
        indices: [],
      };
      entry.indices.push(i);
      groups.set(key, entry);
    }
    for (const [key, { objects, indices }] of groups) {
      const mesh = new InstancedMesh(
        prototype.geometry,
        material,
        indices.length,
      );
      indices.forEach((source, k) =>
        mesh.setMatrixAt(k, matrix.fromArray(matrices, source * 16)),
      );
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = `${name}:${key}`;
      mesh.receiveShadow = true;
      mesh.castShadow = !fauna && !NO_SHADOW.test(name);
      if (fauna) {
        mesh.frustumCulled = false;
        fish.push({
          mesh,
          base: indices.map((source) =>
            new Matrix4().fromArray(matrices, source * 16),
          ),
          school: !!fauna.school,
        });
      }
      group.add(mesh);
      objects?.push(mesh);
    }
  }

  const school = { cx: SCHOOL.cx, cz: SCHOOL.cz };
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  const m = new Matrix4();
  const yaw = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const forward = new Vector3();
  const offset = new Vector3();

  function animateSchool(f: Fish, t: number) {
    const w = SCHOOL.speed / ((SCHOOL.a + SCHOOL.b) * 0.5);
    const th = t * w;
    const cx = school.cx + Math.cos(th) * SCHOOL.a;
    const cz = school.cz + Math.sin(th) * SCHOOL.b;
    const heading = Math.atan2(
      -Math.cos(th) * SCHOOL.b,
      -Math.sin(th) * SCHOOL.a,
    );
    const cy = SCHOOL.y + 0.35 * Math.sin(t * 0.13) + 0.15 * Math.sin(t * 0.41);
    f.base.forEach((b, i) => {
      offset.setFromMatrixPosition(b);
      offset.x += 0.08 * Math.sin(t * 0.7 + i * 1.7);
      offset.y += 0.05 * Math.sin(t * 0.9 + i * 2.3);
      offset.z += 0.08 * Math.cos(t * 0.6 + i * 1.1);
      offset.applyAxisAngle(up, heading);
      p.set(cx + offset.x, cy + offset.y, cz + offset.z);
      q.setFromAxisAngle(up, heading + 0.12 * Math.sin(t * 1.3 + i));
      s.setScalar(1.0 + 0.35 * ((i * 0.618) % 1));
      f.mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    f.mesh.instanceMatrix.needsUpdate = true;
  }

  // Gobies cruise slow loops (Lissajous, 1 : 1.3) round their home spot, 25-55 cm out, slowing now and
  // then but never parked, a few cm above the bottom, always facing the way they swim.
  function animateGobies(f: Fish, t: number) {
    f.base.forEach((b, i) => {
      b.decompose(p, q, s);
      const R = 0.25 + 0.3 * hash(i, 1);
      const Rz = R * (0.7 + 0.5 * hash(i, 2));
      const w = ((0.15 + 0.08 * hash(i, 3)) / R) * 0.25;
      const ph1 = 6.283 * hash(i, 4);
      const ph2 = 6.283 * hash(i, 5);
      const ph3 = 6.283 * hash(i, 6);
      const g = t * w + (0.85 * Math.sin(t * w * 0.6 + ph3)) / 0.6;
      p.x += R * Math.sin(g + ph1);
      p.z += Rz * Math.sin(1.3 * g + ph2);
      p.y +=
        0.03 + 0.02 * Math.sin(g * 0.9 + ph3) + 0.004 * Math.sin(t * 2.1 + i);
      const dx = R * Math.cos(g + ph1);
      const dz = 1.3 * Rz * Math.cos(1.3 * g + ph2);
      forward.set(1, 0, 0).applyQuaternion(q);
      const baseHeading = Math.atan2(-forward.z, forward.x);
      q.premultiply(
        yaw.setFromAxisAngle(up, Math.atan2(-dz, dx) - baseHeading),
      );
      f.mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    f.mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    /** The school follows the chapter the camera is in. */
    setStage(centre: Vector3) {
      school.cx = SCHOOL.cx + centre.x;
      school.cz = SCHOOL.cz + centre.z;
    },
    update(seconds: number) {
      for (const f of fish)
        if (f.school) animateSchool(f, seconds);
        else if (f.mesh.visible) animateGobies(f, seconds);
    },
    dispose() {
      group.removeFromParent();
      for (const item of disposables) item.dispose();
    },
  };
}
