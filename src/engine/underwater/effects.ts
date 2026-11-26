import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Points,
  Raycaster,
  Shape,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Object3D,
  type PerspectiveCamera,
  type WebGLRenderer,
} from 'three';
import { createSurveyShot } from './surveyShot';
import { waterize, type WaterMaterialData, type WaterUniforms } from './water';

/**
 * The S1 hotspot effects, ported from the 3D team's viewer (25 Nov 2026). Both are "made visible" layers
 * for things that can't be seen in reality, and say so in a label:
 * - the open casing's explosive fill dissolving and drifting down-current to the mussels (hotspot 2);
 * - a survey AUV flying lanes over the mine field, its multibeam sonar mapping the bottom (hotspot 3).
 */

type Locale = 'en' | 'de';
export type LabelText = Record<Locale, [title: string, note: string]>;

/** The element labels are drawn in (over the canvas), and the page language. */
export interface Overlay {
  element: HTMLElement;
  locale: () => string;
}

export interface PlumeConfig {
  /** The open casing the fill leaks from; its local +Y points out of the mouth. */
  casing: string;
  /** Hotspot that shows the plume while the camera is there. */
  hotspot: string;
  /** Current direction in the xz plane. */
  direction: [number, number];
  width: number;
  length: number;
  label: LabelText;
}

export interface SurveyConfig {
  /** Hotspot that times the pass so the AUV crosses its view. */
  hotspot: string;
  /** Model node the camera settles on after the pass. */
  subject: string;
  /** Lanes along x at these z, relative to the chapter centre. */
  lanes: number[];
  from: number;
  to: number;
  height: number;
  /** Metres a second. */
  speed: number;
  /** Swath half-width on the floor (m). */
  halfWidth: number;
  label: LabelText;
}

/** A label pinned to a point in the scene, drawn over the canvas. */
function createLabel(
  { element: overlay, locale: pageLocale }: Overlay,
  text: LabelText,
  warm: boolean,
) {
  const element = document.createElement('div');
  const title = document.createElement('b');
  const note = document.createElement('span');
  element.append(title, note);
  element.setAttribute('aria-hidden', 'true');
  // Already in the page language: browser page translation would mangle it.
  element.setAttribute('translate', 'no');
  Object.assign(element.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    transform: 'translate(-50%, -100%)',
    padding: '5px 10px',
    borderRadius: '8px',
    pointerEvents: 'none',
    background: warm ? 'rgba(20, 16, 8, 0.6)' : 'rgba(6, 18, 24, 0.6)',
    color: warm ? '#f3d9a0' : '#bfeaff',
    border: `1px solid ${warm ? 'rgba(243, 200, 120, 0.35)' : 'rgba(120, 210, 255, 0.35)'}`,
    backdropFilter: 'blur(6px)',
    fontSize: '12px',
    fontWeight: '600',
    lineHeight: '1.3',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    visibility: 'hidden',
  } satisfies Partial<CSSStyleDeclaration>);
  Object.assign(note.style, {
    display: 'block',
    fontSize: '10.5px',
    fontWeight: '400',
    opacity: '0.8',
  });
  overlay.append(element);
  let shownLocale = '';
  const projected = new Vector3();
  return {
    /** Shows the label at `point`, or hides it. `edge` lets it sit a little off screen, pinned to the edge. */
    update(
      point: Vector3 | null,
      camera: PerspectiveCamera,
      opacity = 1,
      edge = false,
    ) {
      if (!point) {
        element.style.visibility = 'hidden';
        return;
      }
      projected.copy(point).project(camera);
      const limitX = edge ? 1.6 : 0.95;
      const limitY = edge ? 1.2 : 0.95;
      if (
        projected.z >= 1 ||
        Math.abs(projected.x) > limitX ||
        Math.abs(projected.y) > limitY
      ) {
        element.style.visibility = 'hidden';
        return;
      }
      const locale: Locale = pageLocale() === 'de' ? 'de' : 'en';
      if (locale !== shownLocale) {
        shownLocale = locale;
        [title.textContent, note.textContent] = text[locale];
      }
      const width = overlay.clientWidth;
      const height = overlay.clientHeight;
      if (edge) {
        const margin = Math.min(0.8, (110 / width) * 2);
        projected.x = MathUtils.clamp(projected.x, -1 + margin, 1 - margin);
        projected.y = MathUtils.clamp(projected.y, -0.8, 0.85);
      }
      element.style.translate = `${((projected.x + 1) / 2) * width}px ${((1 - projected.y) / 2) * height}px`;
      element.style.opacity = opacity.toFixed(2);
      element.style.visibility = 'visible';
    },
    dispose() {
      element.remove();
    },
  };
}

/** An irregular crusty lump of explosive fill: a displaced sphere, dull ochre to dark crust. */
function lumpGeometry(radius: number, seed: number, flat = 0.6) {
  const geometry = new SphereGeometry(radius, 12, 8);
  const position = geometry.attributes.position!;
  const colours = new Float32Array(position.count * 3);
  const v = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    n.copy(v).normalize();
    const k =
      0.82 +
      0.14 * Math.sin(n.x * 4.1 + seed) * Math.cos(n.z * 3.7 + seed * 1.3) +
      0.08 * Math.sin(n.y * 6.3 + seed * 2.1);
    v.multiplyScalar(k);
    v.y *= flat;
    position.setXYZ(i, v.x, v.y, v.z);
    const t = Math.min(
      1,
      Math.max(
        0,
        0.5 +
          0.5 * Math.sin(n.x * 5.3 + n.z * 4.1 + seed * 3.0) +
          0.25 * (n.y < 0 ? 1 : 0),
      ),
    );
    colours[i * 3] = 0.17 - 0.09 * t;
    colours[i * 3 + 1] = 0.125 - 0.08 * t;
    colours[i * 3 + 2] = 0.045 - 0.03 * t;
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The torn steel rim at the casing's open end: uneven thickness and height, a jagged lip, two cracks and a
 * real gap where the torn tongue rises. Built in casing-local space.
 */
function rimGeometry() {
  const GAP0 = -0.55;
  const GAP1 = 0.3;
  const SPAN = Math.PI * 2 - (GAP1 - GAP0);
  const N = 72;
  const M = 8;
  const positions: number[] = [];
  const colours: number[] = [];
  const index: number[] = [];
  const h = (k: number) => {
    const x = Math.sin(k * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  const crack = (a: number) =>
    1 -
    0.75 * Math.exp(-((a - 1.9) ** 2) / 0.004) -
    0.7 * Math.exp(-((a - 3.9) ** 2) / 0.003);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = GAP1 + u * SPAN;
    const taper = Math.min(1, u / 0.07, (1 - u) / 0.07);
    const R =
      0.365 + 0.022 * Math.sin(a * 3.0 + 0.7) + 0.012 * Math.sin(a * 11.0);
    const t =
      0.06 *
      (0.65 + 0.35 * Math.sin(a * 5.0 + 1.1) + 0.25 * Math.sin(a * 13.0)) *
      crack(a) *
      (0.15 + 0.85 * taper);
    const yc =
      0.8 +
      0.03 * Math.sin(a * 4.0 + 2.0) +
      0.022 * Math.abs(Math.sin(a * 9.0)) -
      0.03 * (1 - taper);
    for (let j = 0; j <= M; j++) {
      const b = (j / M) * Math.PI * 2;
      const r = t * (1 + 0.25 * (h(i * 31 + j * 7) - 0.5));
      let dy = Math.sin(b) * r * 0.8;
      if (Math.sin(b) > 0.3) dy += t * 0.6 * (h(i * 13 + 3) - 0.3);
      const rr = R + Math.cos(b) * r;
      positions.push(Math.cos(a) * rr, yc + dy, Math.sin(a) * rr);
      const n = 0.5 + 0.3 * Math.sin(a * 7.0 + j) + 0.2 * h(i * 5 + j);
      const fresh =
        Math.max(0, Math.sin(a * 5.0 + 2.0) - 0.8) * 4.0 +
        (crack(a) < 0.6 ? 0.8 : 0);
      colours.push(
        0.045 + 0.04 * n + 0.08 * fresh,
        0.03 + 0.024 * n + 0.028 * fresh,
        0.016 + 0.008 * n,
      );
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a0 = i * (M + 1) + j;
      const a1 = a0 + M + 1;
      index.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

const PLUME_PARTICLE_GLSL = {
  vertex: /* glsl */ `uniform float uTime, uScale; uniform vec4 uPlume, uPlumeDir; uniform float uPlumeH[8]; uniform vec3 uPlumeAxis;
    attribute float seed, kind; varying float vA; varying float vK; varying vec3 vW;
    float groundAt(float s) {
      float x = clamp(s / uPlumeDir.w, 0.0, 1.0) * 7.0; int i = int(min(floor(x), 6.0)); float a = uPlumeH[0];
      for (int k = 0; k < 7; k++) if (k == i) a = mix(uPlumeH[k], uPlumeH[k + 1], x - float(k));
      return a;
    }
    void main(){
      float life = kind < 0.5 ? 9.0 : 16.0;
      float ph = fract(uTime / life + seed);
      vec2 dir = uPlumeDir.xy, nrm = vec2(-dir.y, dir.x);
      vec3 ax = normalize(uPlumeAxis);
      vec3 sideA = normalize(cross(ax, vec3(0.0, 1.0, 0.0))), upA = cross(sideA, ax);
      float exitT = kind < 0.5 ? 0.30 : 0.15;
      float ex = smoothstep(0.0, exitT, ph);
      vec2 o0 = (vec2(fract(seed * 13.7), fract(seed * 29.1)) - 0.5) * (kind < 0.5 ? 0.06 : 0.04);
      vec3 p = uPlume.xyz + ax * (kind < 0.5 ? mix(-0.075, 0.0, ex) : 0.03) + sideA * o0.x + upA * o0.y;
      float q = max(ph - exitT, 0.0) / (1.0 - exitT);
      float s = q * (kind < 0.5 ? 0.35 : 1.6) * (0.6 + 0.8 * fract(seed * 7.3));
      float off = (fract(seed * 13.7) - 0.5) * (kind < 0.5 ? 0.10 : 0.10 + 0.35 * s) * q;
      off += (kind < 0.5 ? 0.025 : 0.05) * sin(uTime * (0.4 + 0.5 * fract(seed * 3.3)) + seed * 30.0) * q;
      float rise = kind < 0.5 ? (0.02 + 0.09 * fract(seed * 5.1)) * sqrt(q) + 0.008 * sin(uTime * 1.3 + seed * 17.0) * q
                              : (0.04 + 0.12 * q) * q;
      p += vec3(dir.x * s + nrm.x * off, 0.0, dir.y * s + nrm.y * off);
      p.y = max(p.y, groundAt(s) + 0.01) + rise;
      vW = p;
      vec4 mv = viewMatrix * vec4(p, 1.0);
      float d = max(-mv.z, 0.05);
      float size = kind < 0.5 ? ((0.002 + 0.003 * fract(seed * 9.1)) * (1.0 - 0.7 * ph)) : (0.12 + 0.25 * ph);
      gl_PointSize = size * uScale / d;
      vA = uPlume.w * smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.45, 1.0, ph)) * (kind < 0.5 ? 0.55 : 0.15) * (kind < 0.5 ? 1.0 : smoothstep(0.05, 0.35, ph));
      vK = kind;
      gl_Position = projectionMatrix * mv; }`,
  fragment: /* glsl */ `varying float vA; varying float vK; varying vec3 vW;
    void main(){ float r = length(gl_PointCoord - 0.5);
      if (r >= 0.5 || vA <= 0.0) discard;
      float a = vK < 0.5 ? smoothstep(0.5, 0.2, r) : smoothstep(0.5, 0.15, r) * (0.75 + 0.25 * sin(gl_PointCoord.x * 9.0 + gl_PointCoord.y * 7.0));
      vec3 v = vW - cameraPosition; float d = length(v);
      vec3 col = mix(vK < 0.5 ? vec3(0.85, 0.62, 0.22) : vec3(0.42, 0.26, 0.06), waterColor(v / max(d, 1e-4)), 1.0 - exp(-0.25 * d));
      gl_FragColor = vec4(grade(col), a * vA);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export interface EffectContext {
  root: Object3D;
  uniforms: WaterUniforms;
  waterGlsl: string;
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  overlay: Overlay;
  /** Adds an object to the chapter at `at`, so it hides with it. */
  assignChapter: (object: Object3D, at: Vector3) => void;
}

/**
 * Hotspot 2: always, the exposed fill in the casing mouth, a torn rim and a few lumps on the sediment.
 * While the hotspot is shown: the amber trail on the floor (in the water shaders), flecks lifting off the
 * fill, haze drifting along the trail, the mussels in its path glowing, and the label.
 */
export function createPlume(config: PlumeConfig, context: EffectContext) {
  const { root, uniforms, renderer, camera } = context;
  const casing = root.getObjectByName(config.casing) as Mesh | undefined;
  if (!casing?.isMesh) {
    console.warn(`[scene] Plume: ${config.casing} is missing`);
    return null;
  }
  const disposables: { dispose(): void }[] = [];
  const objects: Object3D[] = [];
  casing.updateMatrixWorld(true);
  const mouth = new Vector3(0, 0.8, 0).applyMatrix4(casing.matrixWorld);
  const axis = new Vector3(0, 1, 0).transformDirection(casing.matrixWorld);
  const direction = new Vector2(...config.direction).normalize();
  const source = mouth.clone().addScaledVector(axis, 0.035);
  uniforms.uPlume.value.set(source.x, source.y, source.z, 0);
  uniforms.uPlumeDir.value.set(
    direction.x,
    direction.y,
    config.width,
    config.length,
  );
  uniforms.uPlumeAxis.value.copy(axis);
  // The interior seen through the opening: dark rust, not black.
  const casingMaterial = casing.material as MeshStandardMaterial;
  (casingMaterial.userData as WaterMaterialData).albedoFloor = 1;
  casingMaterial.needsUpdate = true;

  const rimMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.1,
    side: DoubleSide,
    flatShading: true,
  });
  (rimMaterial.userData as WaterMaterialData).albedoFloor = 1;
  waterize(rimMaterial, uniforms);
  const rim = new Mesh(rimGeometry(), rimMaterial);
  rim.name = 'FX_CasingRim';
  rim.castShadow = rim.receiveShadow = true;
  casing.add(rim);
  objects.push(rim);
  disposables.push(rim.geometry, rimMaterial);

  const fillMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });
  (fillMaterial.userData as WaterMaterialData).plumeK = 0;
  waterize(fillMaterial, uniforms);
  disposables.push(fillMaterial);
  const addLump = (geometry: BufferGeometry, parent: Object3D) => {
    const mesh = new Mesh(geometry, fillMaterial);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    objects.push(mesh);
    disposables.push(geometry);
    return mesh;
  };
  addLump(lumpGeometry(0.24, 1, 0.3), casing).position.set(0, 0.66, 0);
  addLump(lumpGeometry(0.08, 2, 0.7), casing).position.set(0.07, 0.72, -0.08);

  // Lumps on the sediment in front of the mouth, and the floor height along the trail.
  const ground: Object3D[] = [];
  root.traverse((object) => {
    if ((object as Mesh).isMesh && /^ENV_/.test(object.name))
      ground.push(object);
  });
  root.updateMatrixWorld(true);
  const ray = new Raycaster();
  const down = new Vector3(0, -1, 0);
  for (let k = 0; k < 8; k++) {
    const s = (config.length * k) / 7;
    ray.set(
      new Vector3(
        mouth.x + direction.x * s,
        mouth.y + 2,
        mouth.z + direction.y * s,
      ),
      down,
    );
    const hit = ray.intersectObjects(ground, false)[0];
    uniforms.uPlumeH.value[k] = hit ? hit.point.y : mouth.y;
  }
  const flatAxis = axis.clone().setY(0).normalize();
  const side = new Vector3(-flatAxis.z, 0, flatAxis.x);
  const lumps = new Group();
  lumps.name = 'FX_FillLumps';
  (
    [
      [0.05, 0.02, 0.01],
      [0.09, -0.04, 0.007],
      [0.13, 0.05, 0.012],
      [0.07, 0.08, 0.006],
      [0.18, -0.01, 0.008],
    ] as const
  ).forEach(([a, b, r], i) => {
    const at = mouth
      .clone()
      .addScaledVector(flatAxis, a)
      .addScaledVector(side, b);
    ray.set(at.clone().setY(at.y + 0.5), down);
    const hit = ray.intersectObjects(ground, false)[0];
    const lump = addLump(lumpGeometry(r, 10 + i, 0.55), lumps);
    lump.position.set(at.x, (hit ? hit.point.y : at.y) - r * 0.15, at.z);
    lump.rotation.y = i * 1.9;
  });
  root.add(lumps);
  context.assignChapter(lumps, mouth);

  // Flecks (small, lift off and dissolve) and haze puffs (large, faint, drift along the trail).
  const FLECKS = 36;
  const PUFFS = 18;
  const count = FLECKS + PUFFS;
  const seeds = new Float32Array(count);
  const kinds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seeds[i] = Math.random();
    kinds[i] = i < FLECKS ? 0 : 1;
  }
  const particleGeometry = new BufferGeometry();
  particleGeometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(count * 3), 3),
  );
  particleGeometry.setAttribute('seed', new BufferAttribute(seeds, 1));
  particleGeometry.setAttribute('kind', new BufferAttribute(kinds, 1));
  const particleUniforms = { ...uniforms, uScale: { value: 1 } };
  const particleMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: particleUniforms,
    vertexShader: PLUME_PARTICLE_GLSL.vertex,
    fragmentShader: context.waterGlsl + PLUME_PARTICLE_GLSL.fragment,
  });
  const particles = new Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  particles.visible = false;
  root.add(particles);
  objects.push(particles);
  disposables.push(particleGeometry, particleMaterial);

  const labelAt = new Vector3(
    mouth.x + direction.x * 0.2,
    mouth.y + 0.2,
    mouth.z + direction.y * 0.2,
  );
  const label = createLabel(context.overlay, config.label, true);
  let level = 0;
  let target = 0;

  return {
    /** Shows the made-visible layer while `anchor` is the plume's hotspot. */
    focus(anchor: string | null) {
      target = anchor === config.hotspot ? 1 : 0;
    },
    update(delta: number) {
      level += (target - level) * Math.min(1, delta * 1.2);
      if (target === 0 && level < 0.005) level = 0;
      uniforms.uPlume.value.w = level;
      particles.visible = level > 0 && lumps.visible;
      particleUniforms.uScale.value =
        renderer.domElement.height /
        (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
      const shown = level > 0.5 && lumps.visible;
      label.update(
        shown ? labelAt : null,
        camera,
        Math.min(1, (level - 0.5) * 3),
        true,
      );
    },
    dispose() {
      uniforms.uPlume.value.w = 0;
      label.dispose();
      for (const object of objects) object.removeFromParent();
      lumps.removeFromParent();
      for (const item of disposables) item.dispose();
    },
  };
}

/** A generic REMUS-type mapping AUV (2 m): yellow hull, dark tail cone, cruciform fins, mast and a 3-blade prop. */
function auvGeometry() {
  const L = 2.0;
  const R = 0.11;
  const profile = [
    [0.0, 0.0],
    [0.025, 0.02],
    [0.045, 0.1],
    [0.075, 0.24],
    [0.1, 0.4],
    [R, 0.52],
    [R, 1.7],
    [0.104, 1.8],
    [0.088, 1.88],
    [0.062, 1.95],
    [0.03, 1.99],
    [0.0, L],
  ] as const;
  const hull = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    20,
  );
  const position = hull.attributes.position!;
  const colours = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    let c = [0.62, 0.42, 0.03];
    if (y < 0.52) c = [0.035, 0.035, 0.04];
    else if (y > 1.05 && y < 1.12) c = [0.22, 0.22, 0.22];
    else if (y > 1.93) c = [0.05, 0.05, 0.055];
    colours.set(c, i * 3);
  }
  hull.setAttribute('color', new BufferAttribute(colours, 3));
  hull.rotateZ(-Math.PI / 2);
  hull.translate(-L / 2, 0, 0);
  const body: BufferGeometry[] = [hull];
  const tint = (geometry: BufferGeometry, rgb = [0.04, 0.04, 0.045]) => {
    const n = geometry.attributes.position!.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set(rgb, i * 3);
    geometry.setAttribute('color', new BufferAttribute(c, 3));
    return geometry;
  };
  for (let k = 0; k < 4; k++) {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.13, 0);
    shape.lineTo(0.1, 0.1);
    shape.lineTo(0.03, 0.1);
    shape.lineTo(0, 0);
    const fin = new ExtrudeGeometry(shape, {
      depth: 0.008,
      bevelEnabled: false,
    });
    fin.translate(-L / 2 + 0.16, 0.04, -0.004);
    fin.rotateX((k * Math.PI) / 2);
    body.push(tint(fin));
  }
  const blades: BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const blade = new BoxGeometry(0.006, 0.075, 0.022);
    blade.translate(0, 0.04, 0);
    blade.rotateY(0.5);
    blade.rotateX((k * 2 * Math.PI) / 3);
    blades.push(tint(blade, [0.1, 0.09, 0.08]));
  }
  const mast = new CylinderGeometry(0.008, 0.012, 0.12, 6);
  mast.translate(-0.55, 0.104 - 0.008 + 0.06, 0);
  body.push(tint(mast));
  const dome = new SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1.6, 0.5, 1.0);
  dome.rotateX(Math.PI);
  dome.translate(0.15, -R + 0.01, 0);
  body.push(tint(dome, [0.12, 0.12, 0.12]));
  return { body: merge(body), blades: merge(blades) };
}

/** Merges positions, normals and colours of a few small parts into one geometry. */
function merge(parts: BufferGeometry[]) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  for (const part of parts) {
    const flat = part.index ? part.toNonIndexed() : part;
    if (!flat.attributes.normal) flat.computeVertexNormals();
    positions.push(...(flat.attributes.position!.array as Float32Array));
    normals.push(...(flat.attributes.normal!.array as Float32Array));
    colours.push(...(flat.attributes.color!.array as Float32Array));
    part.dispose();
    if (flat !== part) flat.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new Float32BufferAttribute(colours, 3));
  return merged;
}

/**
 * Hotspot 3: the AUV flies a lawnmower survey over the chapter's mine field, its sonar a translucent cyan
 * fan with pings travelling down, and on the bottom a sweeping scan line leaving a fading depth map (in the
 * water shaders). Always flying in the chapter; brighter, labelled and timed to cross the view at its hotspot.
 */
export function createSurvey(
  config: SurveyConfig,
  centre: Vector3,
  context: EffectContext,
) {
  const { uniforms, camera, root } = context;
  const disposables: { dispose(): void }[] = [];
  const waypoints: Vector3[] = [];
  const lanes = config.lanes.map((z) => z + centre.z);
  lanes.forEach((z, i) => {
    const [a, b] = i % 2 ? [config.to, config.from] : [config.from, config.to];
    waypoints.push(
      new Vector3(centre.x + a, config.height, z),
      new Vector3(centre.x + (a + b) / 2, config.height, z),
      new Vector3(centre.x + b, config.height, z),
    );
  });
  waypoints.push(
    new Vector3(
      centre.x + config.from - 1.6,
      config.height + 0.3,
      lanes.at(-1)!,
    ),
    new Vector3(centre.x + config.from - 1.6, config.height + 0.3, lanes[0]!),
  );
  const curve = new CatmullRomCurve3(waypoints, true, 'centripetal', 0.5);
  const length = curve.getLength();
  const subject = root.getObjectByName(config.subject) as Mesh | undefined;
  if (subject?.isMesh && !subject.geometry.boundingSphere)
    subject.geometry.computeBoundingSphere();
  const sphere = subject?.isMesh ? subject.geometry.boundingSphere : null;
  const shot =
    sphere && subject
      ? createSurveyShot(
          camera,
          curve,
          length,
          config.speed,
          subject.localToWorld(sphere.center.clone()),
          centre,
        )
      : null;

  const { body, blades } = auvGeometry();
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0,
  });
  (material.userData as WaterMaterialData).scanK = 0;
  waterize(material, uniforms);
  const group = new Group();
  group.name = 'FX_AUV';
  const hull = new Mesh(body, material);
  const prop = new Mesh(blades, material);
  prop.position.set(-1.01, 0, 0);
  group.add(hull, prop);
  for (const mesh of [hull, prop]) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  }
  disposables.push(body, blades, material);

  // The multibeam fan: across the track, pointing down, 90 degrees wide. The floor clips it.
  const SEGMENTS = 28;
  const reach = 3.4;
  const fanPositions = [0, -0.11, 0];
  const fanRadius = [0];
  const fanAngle = [0];
  const fanIndex: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = -Math.PI / 4 + (i / SEGMENTS) * (Math.PI / 2);
    for (const t of [0.5, 1.0]) {
      fanPositions.push(
        0,
        -0.11 - Math.cos(a) * reach * t,
        Math.sin(a) * reach * t,
      );
      fanRadius.push(t);
      fanAngle.push(i / SEGMENTS);
    }
  }
  for (let i = 0; i < SEGMENTS; i++) {
    const m0 = 1 + i * 2;
    const m1 = m0 + 2;
    fanIndex.push(0, m0, m1, m0, m0 + 1, m1 + 1, m0, m1 + 1, m1);
  }
  const fanGeometry = new BufferGeometry();
  fanGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(fanPositions, 3),
  );
  fanGeometry.setAttribute('aR', new Float32BufferAttribute(fanRadius, 1));
  fanGeometry.setAttribute('aA', new Float32BufferAttribute(fanAngle, 1));
  fanGeometry.setIndex(fanIndex);
  const fanUniforms = { uTime: uniforms.uTime, uOn: { value: 0 } };
  const fanMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: fanUniforms,
    vertexShader: `attribute float aR, aA; varying float vR, vA; varying vec3 vW;
      void main(){ vR = aR; vA = aA; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uOn; varying float vR, vA; varying vec3 vW;
      void main(){
        float edge = smoothstep(0.0, 0.08, vA) * smoothstep(1.0, 0.92, vA);
        float body = 0.11 * (1.0 - vR * 0.5);
        float ping = 0.0;
        for (int k = 0; k < 2; k++) { float f = fract(uTime * 0.9 + float(k) * 0.5); ping += exp(-pow((vR - f) / 0.035, 2.0)) * (1.0 - f); }
        float beams = 0.5 + 0.5 * sin(vA * 120.0);
        float a = (body + ping * 0.45) * edge * (0.6 + 0.4 * beams) * uOn;
        float d = length(vW - cameraPosition); a *= 1.0 - smoothstep(4.0, 11.0, d);
        gl_FragColor = vec4(vec3(0.45, 0.85, 1.0) * a, a);
      }`,
  });
  const fan = new Mesh(fanGeometry, fanMaterial);
  fan.frustumCulled = false;
  fan.renderOrder = 2;
  group.add(fan);
  disposables.push(fanGeometry, fanMaterial);
  root.add(group);
  context.assignChapter(group, centre);

  const label = createLabel(context.overlay, config.label, false);
  let level = 0.85;
  let focusTarget = 0.85;
  let labelled = false;
  let phase = 0;
  let time = 0;
  /** The camera is flying to the hotspot: the pass is timed again on arrival, if the AUV is out of view. */
  let waitingForArrival = false;
  const hotspot = root.getObjectByName(config.hotspot);
  const view = root.getObjectByName(`${config.hotspot}_view`);
  const viewAt = view?.getWorldPosition(new Vector3()) ?? null;
  const onScreen = new Vector3();
  /**
   * Puts the AUV on its lane so it passes the hotspot `lead` seconds from now: it enters the view about a
   * second after the camera lands and crosses the middle of it.
   */
  function timePass(lead: number) {
    if (!hotspot) return;
    const at = hotspot.getWorldPosition(new Vector3());
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i <= 400; i++) {
      curve.getPointAt(i / 400, point);
      const d = (point.x - at.x) ** 2 + (point.z - at.z) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = i / 400;
      }
    }
    const want = (best - (lead * config.speed) / length + 1) % 1;
    phase = want - (time * config.speed) / length;
  }
  /** About how long the camera takes to land at the hotspot's view (it eases in at about 2.2 per second). */
  const flightSeconds = () =>
    viewAt
      ? Math.log(Math.max(1, camera.position.distanceTo(viewAt) / 0.3)) / 2.2
      : 0;
  const CROSSING_LEAD = 2.5;
  const point = new Vector3();
  const tangent = new Vector3();
  const ahead = new Vector3();
  const labelAt = new Vector3();

  return {
    startShot(anchor: string) {
      if (anchor !== config.hotspot || !shot) return false;
      waitingForArrival = false;
      shot.start();
      return true;
    },
    updateShot(seconds: number, delta: number) {
      const u = shot?.update(delta);
      if (u === undefined) return false;
      phase = u - (seconds * config.speed) / length;
      return true;
    },
    cancelShot() {
      shot?.cancel();
    },
    /** Featured at its hotspot: brighter, labelled, and timed to cross the view. */
    focus(anchor: string | null) {
      const on = anchor === config.hotspot;
      focusTarget = on ? 1 : 0.85;
      labelled = on;
      waitingForArrival = on;
      if (on) timePass(flightSeconds() + CROSSING_LEAD);
    },
    update(seconds: number, delta: number) {
      time = seconds;
      // Our flights take longer than the artist's viewer: by arrival the timed pass can be over.
      if (
        waitingForArrival &&
        viewAt &&
        camera.position.distanceTo(viewAt) < 0.5
      ) {
        waitingForArrival = false;
        onScreen.copy(group.position).project(camera);
        if (
          onScreen.z >= 1 ||
          Math.abs(onScreen.x) > 1.1 ||
          Math.abs(onScreen.y) > 1.1
        )
          timePass(CROSSING_LEAD);
      }
      level += (focusTarget - level) * Math.min(1, delta * 1.5);
      const u = ((((seconds * config.speed) / length + phase) % 1) + 1) % 1;
      curve.getPointAt(u, point);
      curve.getTangentAt(u, tangent);
      curve.getTangentAt((u + 0.004) % 1, ahead);
      const turn = Math.atan2(
        tangent.x * ahead.z - tangent.z * ahead.x,
        tangent.x * ahead.x + tangent.z * ahead.z,
      );
      const straight = 1 - Math.min(1, Math.abs(turn) * 18);
      group.position.set(
        point.x,
        point.y + 0.02 * Math.sin(seconds * 0.7),
        point.z,
      );
      group.rotation.set(0, Math.atan2(-tangent.z, tangent.x), 0);
      group.rotateX(-turn * 6.0);
      prop.rotation.x = seconds * 14.0;
      const on = level * straight * (group.visible ? 1 : 0);
      fanUniforms.uOn.value = on;
      uniforms.uScan.value.set(point.x, point.y, point.z, on);
      const flat = Math.hypot(tangent.x, tangent.z) || 1;
      uniforms.uScanDir.value.set(
        tangent.x / flat,
        tangent.z / flat,
        config.halfWidth,
        4.0,
      );
      label.update(
        labelled && on > 0.3 ? labelAt.copy(point).setY(point.y + 0.35) : null,
        camera,
      );
    },
    dispose() {
      uniforms.uScan.value.w = 0;
      label.dispose();
      group.removeFromParent();
      for (const item of disposables) item.dispose();
    },
  };
}
