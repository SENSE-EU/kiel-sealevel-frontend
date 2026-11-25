import {
  AgXToneMapping,
  Box3,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  NoToneMapping,
  SRGBColorSpace,
  Vector3,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type Texture,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { createLoader } from '../loadModel';
import type { SceneLook } from '../SceneLook';
import { createUniforms, createWater, LOOK, waterize } from './water';

/**
 * A scene the 3D team delivers as several files rather than one GLB: a base pack with the sea floor and
 * every anchor, chapter packs fetched up front, instanced vegetation, and close-up texture packs fetched
 * when the camera gets near their object.
 */
export interface ScenePackage {
  /** Folder the files are served from, ending in `/`. */
  root: string;
  /** Sea floor, props and every viewpoint and hotspot node. */
  base: string;
  /** Sites along one seabed, far enough apart that the fog hides one from the other. */
  chapters: { id: string; centre: [number, number, number]; pack?: string }[];
  vegetation?: { meshes: string; instances: string };
  detail: { file: string; objects: string[]; radius: number }[];
  /** The chapter subjects the light gathers on: anchor node and radius in metres. */
  focus: [anchor: string, radius: number][];
  /** Content anchor names mapped to this model's nodes, for content written against other names. */
  anchorAliases?: Record<string, string>;
}

export interface LoadedPackage {
  root: Group;
  look: SceneLook;
}

interface VegetationData {
  sway: Record<string, number>;
  fauna?: Record<string, unknown>;
  instances: Record<string, number[]>;
}

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
] as const;
type TextureKey = (typeof TEXTURE_KEYS)[number];
/** A chapter is drawn while the camera is this close to its centre, so a flight between two shows both. */
const CHAPTER_DRAW_DISTANCE = LOOK.visibility + 4;
/** Thin cards and branches skip the shadow pass. */
const NO_SHADOW = /^VEG_(Eelgrass|Fuzz|RedBush)/;

/** Phones get no live shadows, smaller caustics, fewer fuzz shells and a lower pixel ratio. */
export function isPhoneTier() {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    Math.min(window.innerWidth, window.innerHeight) < 500
  );
}

function standardMaterials(root: Object3D) {
  const out: MeshStandardMaterial[] = [];
  root.traverse((object) => {
    const material = (object as Mesh).material;
    if ((material as MeshStandardMaterial | undefined)?.isMeshStandardMaterial)
      out.push(material as MeshStandardMaterial);
  });
  return out;
}

function texturesOf(root: Object3D) {
  const out = new Set<Texture>();
  for (const material of standardMaterials(root))
    for (const key of TEXTURE_KEYS) if (material[key]) out.add(material[key]);
  return [...out];
}

/** Hydroid turf strands, drawn into a canvas at load: two tufts side by side, base at the bottom. */
function makeFuzzTexture(size = 256, seed = 7) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  let r = seed;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
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
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export async function loadScenePackage(
  pkg: ScenePackage,
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  onProgress: (fraction: number) => void,
): Promise<LoadedPackage> {
  const phone = isPhoneTier();
  const uniforms = createUniforms();
  const { loader, dispose: disposeLoader } = createLoader(renderer);
  const load = (file: string, progress?: (fraction: number) => void) =>
    loader.loadAsync(pkg.root + file, (event) => {
      if (progress && event.lengthComputable)
        progress(event.loaded / event.total);
    });
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  // AgX, matched to the artist's Cycles renders.
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = !phone;
  scene.background = null;
  scene.fog = null;

  const root = new Group();
  root.name = 'scene-package';
  scene.add(root);

  // Chapters: every mesh belongs to the chapter whose centre is nearest.
  const chapters = pkg.chapters.map((chapter) => ({
    ...chapter,
    centre: new Vector3(...chapter.centre),
    objects: [] as Object3D[],
  }));
  const chapterOf = (point: Vector3) => {
    let best = chapters[0]!;
    let bestDistance = Infinity;
    for (const chapter of chapters) {
      const distance =
        (point.x - chapter.centre.x) ** 2 + (point.z - chapter.centre.z) ** 2;
      if (distance < bestDistance) {
        best = chapter;
        bestDistance = distance;
      }
    }
    return best;
  };
  const box = new Box3();
  const centre = new Vector3();
  const assignChapter = (object: Object3D, at?: Vector3) => {
    chapterOf(at ?? box.setFromObject(object).getCenter(centre)).objects.push(
      object,
    );
  };

  // The chapter-2 sea floor shares chapter 1's materials: patch each material once.
  const waterized = new WeakSet<MeshStandardMaterial>();
  const fuzzShells = phone ? 3 : 5;

  /**
   * The mine's fouling fringe: a decimated copy of the prop carrying `_fuzz`, drawn as stacked shells in
   * one instanced draw. Each shell alpha-tests a strand lattice taken at the base surface position.
   */
  function makeShellFuzz(proxy: Mesh) {
    const geometry = proxy.geometry;
    const parent = proxy.parent;
    proxy.removeFromParent();
    if (!geometry.attributes._fuzz || !parent) return;
    const material = new MeshStandardMaterial({
      color: new Color(0.085, 0.072, 0.044),
      roughness: 1,
      metalness: 0,
    });
    waterize(material, uniforms);
    const base = material.onBeforeCompile;
    const fuzzUniforms = {
      uFuzzLen: { value: 0.03 },
      uFuzzDen: { value: 170.0 },
      uShells: { value: fuzzShells },
    };
    material.onBeforeCompile = (
      shader: WebGLProgramParametersWithUniforms,
      r: WebGLRenderer,
    ) => {
      base.call(material, shader, r);
      Object.assign(shader.uniforms, fuzzUniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float _fuzz;\nuniform float uFuzzLen, uShells;\nvarying vec3 vFBase; varying float vFz, vFh;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vFh = (float(gl_InstanceID) + 1.0) / uShells;
          vFz = _fuzz; vFBase = position;
          float fLen = uFuzzLen * smoothstep(0.12, 0.7, _fuzz);
          transformed += objectNormal * vFh * fLen;
          transformed += vec3(0.7, 0.0, 0.35) * fLen * 0.55 * vFh * vFh * sin(uTime * 0.9 + position.x * 9.0 + position.z * 6.0);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uFuzzDen;
          varying vec3 vFBase; varying float vFz, vFh;
          float fzh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`,
        )
        .replace(
          '#include <alphatest_fragment>',
          `{
            vec3 q = vFBase * uFuzzDen, cell = floor(q), fq = fract(q) - 0.5;
            float keep = smoothstep(0.12, 0.75, vFz);
            if (fzh(cell) > keep * 0.95) discard;
            vec3 jit = vec3(fzh(cell + 1.3), fzh(cell + 2.7), fzh(cell + 4.1)) - 0.5;
            float tall = 0.45 + 0.55 * fzh(cell + 7.7);
            if (vFh > tall) discard;
            float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
            if (fzh(cell + 5.5) < smoothstep(0.2, 0.65, ndv)) discard;
            float rad = 0.46 * pow(1.0 - vFh / tall, 0.5) * (0.7 + 0.5 * fzh(cell + 9.1));
            if (length(fq - jit * 0.45) > rad) discard;
            diffuseColor.rgb *= mix(0.72, 1.05, vFh / tall) * (0.8 + 0.4 * fzh(cell + 3.3));
          }
          #include <alphatest_fragment>`,
        );
    };
    material.customProgramCacheKey = () => 'water-fuzz';
    const shells = new InstancedMesh(geometry, material, fuzzShells);
    shells.name = proxy.name;
    shells.position.copy(proxy.position);
    shells.quaternion.copy(proxy.quaternion);
    shells.scale.copy(proxy.scale);
    shells.receiveShadow = true;
    parent.add(shells);
  }

  /** Water, shadows and chapters for a freshly loaded pack. */
  function prepare(pack: Object3D) {
    const fuzzProxies: Mesh[] = [];
    pack.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name.startsWith('FX_Fuzz_')) {
        fuzzProxies.push(mesh);
        return;
      }
      mesh.receiveShadow = true;
      mesh.castShadow = !mesh.name.startsWith('ENV_');
      const material = mesh.material as MeshStandardMaterial;
      for (const key of TEXTURE_KEYS)
        if (material[key]) material[key].anisotropy = maxAnisotropy;
      // The sea floor: the seabed chunks and the pile's sand mound, sharing one material.
      const sand =
        /^MAT_Seabed_Web/.test(material.name) ||
        /^ENV_(Seabed(_c\d)?|PileMound)$/.test(mesh.name);
      if (!waterized.has(material)) {
        waterized.add(material);
        waterize(material, uniforms, { sand });
      }
    });
    for (const proxy of fuzzProxies) makeShellFuzz(proxy);
    pack.updateMatrixWorld(true);
    pack.traverse((object) => {
      // The skirt runs under every chapter, so it is always drawn.
      if ((object as Mesh).isMesh && object.name !== 'ENV_Seabed_Skirt')
        assignChapter(object);
    });
  }

  const findObject = (name: string) => root.getObjectByName(name) ?? null;

  const base = await load(pkg.base, onProgress);
  root.add(base.scene);
  prepare(base.scene);

  const [, vegetation] = await Promise.all([
    Promise.all(
      chapters.map(async (chapter) => {
        if (!chapter.pack) return;
        try {
          const gltf = await load(chapter.pack);
          root.add(gltf.scene);
          prepare(gltf.scene);
        } catch (error) {
          console.error(`[scene] Chapter pack ${chapter.pack} failed`, error);
        }
      }),
    ),
    pkg.vegetation
      ? Promise.all([
          load(pkg.vegetation.meshes),
          fetch(pkg.root + pkg.vegetation.instances).then(
            (response) => response.json() as Promise<VegetationData>,
          ),
        ]).catch((error: unknown) => {
          console.error('[scene] Vegetation failed to load', error);
          return null;
        })
      : null,
  ]);

  // Vegetation: one InstancedMesh per species and chapter, so a hidden chapter costs nothing. Fish are
  // in the data but hidden for now, as in the artist's viewer.
  if (vegetation) {
    const [gltf, data] = vegetation;
    const fuzzTexture = makeFuzzTexture();
    const matrix = new Matrix4();
    const position = new Vector3();
    const group = new Group();
    group.name = 'vegetation';
    for (const [name, matrices] of Object.entries(data.instances)) {
      if (data.fauna?.[name]) continue;
      const prototype = gltf.scene.getObjectByName(name) as Mesh | undefined;
      if (!prototype?.isMesh) {
        console.warn(`[scene] Vegetation prototype ${name} is missing`);
        continue;
      }
      let material: MeshStandardMaterial;
      if (name.startsWith('VEG_Fuzz')) {
        material = new MeshStandardMaterial({
          map: fuzzTexture,
          alphaTest: 0.35,
          alphaToCoverage: true,
          side: DoubleSide,
          roughness: 0.9,
          metalness: 0,
        });
        waterize(material, uniforms, { sway: 6.0 });
      } else {
        material = (prototype.material as MeshStandardMaterial).clone();
        material.side = DoubleSide;
        waterize(material, uniforms, { sway: data.sway[name] ?? 0 });
      }
      const byChapter = new Map<(typeof chapters)[number], number[]>();
      for (let i = 0; i < matrices.length / 16; i++) {
        position.fromArray(matrices, i * 16 + 12);
        const chapter = chapterOf(position);
        byChapter.set(chapter, [...(byChapter.get(chapter) ?? []), i]);
      }
      for (const [chapter, indices] of byChapter) {
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
        mesh.name = `${name}:${chapter.id}`;
        mesh.receiveShadow = true;
        mesh.castShadow = !NO_SHADOW.test(name);
        group.add(mesh);
        chapter.objects.push(mesh);
      }
    }
    root.add(group);
  }

  const water = createWater(renderer, scene, uniforms, phone);
  pkg.focus.forEach(([name, radius], i) => {
    const node = findObject(name);
    const slot = uniforms.uFocus.value[i];
    if (node && slot) {
      const p = node.getWorldPosition(new Vector3());
      slot.set(p.x, p.y, p.z, radius);
    }
  });

  // Textures upload one per frame, within about 3 ms, so nothing stutters while the camera moves.
  const uploadQueue: { texture: Texture; done: () => void }[] = [];
  const uploaded = new WeakSet<Texture>();
  const queueUploads = (textures: Texture[]) =>
    Promise.all(
      textures
        .filter((texture) => !uploaded.has(texture))
        .map(
          (texture) =>
            new Promise<void>((done) => uploadQueue.push({ texture, done })),
        ),
    );
  const pumpUploads = () => {
    const start = performance.now();
    do {
      const item = uploadQueue.shift();
      if (!item) break;
      if (!uploaded.has(item.texture)) {
        renderer.initTexture(item.texture);
        uploaded.add(item.texture);
      }
      item.done();
    } while (performance.now() - start < 3);
  };

  let stage: (typeof chapters)[number] | null = null;
  const setStage = (chapter: (typeof chapters)[number]) => {
    if (stage === chapter) return;
    const first = stage === null;
    stage = chapter;
    water.setStage(chapter.centre);
    if (!first) for (const pack of pkg.detail) loadDetailIfIn(pack, chapter);
  };

  const showChapters = (near: Vector3) => {
    for (const chapter of chapters) {
      const dx = near.x - chapter.centre.x;
      const dz = near.z - chapter.centre.z;
      const visible = Math.hypot(dx, dz) < CHAPTER_DRAW_DISTANCE;
      for (const object of chapter.objects) object.visible = visible;
    }
  };

  // Close-up packs: the same meshes with sharp textures, swapped onto the base materials once uploaded.
  const detailState = new Map<string, 'loading' | 'ready'>();
  const detailCentre = (pack: ScenePackage['detail'][number]) => {
    const object = findObject(pack.objects[0]!) as Mesh | null;
    if (!object?.geometry) return null;
    object.geometry.computeBoundingSphere();
    return object.geometry
      .boundingSphere!.center.clone()
      .applyMatrix4(object.matrixWorld);
  };
  function loadDetail(pack: ScenePackage['detail'][number]) {
    if (detailState.has(pack.file)) return;
    detailState.set(pack.file, 'loading');
    load(pack.file).then(
      async (gltf) => {
        const fuzz: Mesh[] = [];
        const drop: Mesh[] = [];
        const swaps: [
          MeshStandardMaterial,
          MeshStandardMaterial,
          TextureKey,
        ][] = [];
        gltf.scene.traverse((object) => {
          const mesh = object as Mesh;
          if (!mesh.isMesh) return;
          if (mesh.name.startsWith('FX_Fuzz_')) {
            fuzz.push(mesh);
            return;
          }
          const target = findObject(mesh.name) as Mesh | null;
          const sharp = mesh.material as MeshStandardMaterial;
          if (target)
            for (const key of TEXTURE_KEYS)
              if (sharp[key]) {
                sharp[key].anisotropy = maxAnisotropy;
                swaps.push([
                  target.material as MeshStandardMaterial,
                  sharp,
                  key,
                ]);
              }
          drop.push(mesh);
        });
        for (const mesh of drop) {
          mesh.removeFromParent();
          mesh.geometry.dispose();
        }
        for (const proxy of fuzz) makeShellFuzz(proxy);
        await Promise.all([
          queueUploads(swaps.map(([, sharp, key]) => sharp[key]!)),
          queueUploads(texturesOf(gltf.scene)),
          renderer.compileAsync(gltf.scene, camera, scene).catch(() => {}),
        ]);
        for (const [material, sharp, key] of swaps) {
          const old = material[key];
          if (old && old !== sharp[key]) old.dispose();
          material[key] = sharp[key];
        }
        root.add(gltf.scene);
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((object) => {
          if ((object as Mesh).isMesh) assignChapter(object);
        });
        detailState.set(pack.file, 'ready');
      },
      (error: unknown) => {
        console.error(`[scene] Close-up pack ${pack.file} failed`, error);
        detailState.delete(pack.file);
      },
    );
  }
  function loadDetailIfIn(
    pack: ScenePackage['detail'][number],
    chapter: (typeof chapters)[number],
  ) {
    const at = detailCentre(pack);
    if (at && chapterOf(at) === chapter) loadDetail(pack);
  }
  const loadDetailNear = (point: Vector3, slack = 1) => {
    for (const pack of pkg.detail) {
      const at = detailCentre(pack);
      if (at && at.distanceTo(point) < pack.radius * slack) loadDetail(pack);
    }
  };

  // Warm-up behind the loading screen: every shader compiled, including the shadow passes (one frame per
  // chapter), and every texture uploaded, so the first look at the mine doesn't stall.
  for (const chapter of chapters)
    for (const object of chapter.objects) object.visible = true;
  try {
    await renderer.compileAsync(scene, camera);
  } catch (error) {
    console.warn('[scene] Shader warm-up failed', error);
  }
  const keep = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
  };
  for (const chapter of chapters) {
    water.setStage(chapter.centre);
    camera.position.copy(chapter.centre).add(new Vector3(0, 1.5, 3));
    camera.lookAt(chapter.centre);
    camera.updateMatrixWorld();
    water.renderCaustics();
    renderer.render(scene, camera);
  }
  for (const texture of texturesOf(scene)) {
    renderer.initTexture(texture);
    uploaded.add(texture);
  }
  camera.position.copy(keep.position);
  camera.quaternion.copy(keep.quaternion);
  stage = null;

  let sinceDetailCheck = 0;
  const look: SceneLook = {
    swayScale: 0.25,
    pinRange: LOOK.visibility,
    camera: { near: 0.05, far: 80, horizontalFov: 61.9, maxVerticalFov: 74 },
    maxPixelRatio: phone ? 1.5 : 2,
    update(seconds, delta) {
      uniforms.uTime.value = seconds;
      showChapters(camera.position);
      setStage(chapterOf(camera.position));
      sinceDetailCheck += delta;
      if (sinceDetailCheck > 0.5) {
        sinceDetailCheck = 0;
        loadDetailNear(camera.position);
      }
      pumpUploads();
      water.renderCaustics();
    },
    dispose() {
      water.dispose();
      disposeLoader();
      renderer.toneMapping = NoToneMapping;
      renderer.shadowMap.enabled = false;
    },
  };
  return { root, look };
}
