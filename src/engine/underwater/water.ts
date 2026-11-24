import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  Scene,
  ShaderChunk,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type IUniform,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';

/**
 * Baltic water for the 3D team's scenes: per-channel light absorption, bottom murk, caustics drawn once a
 * frame into a world-space texture, a hero spotlight on each chapter's subject, a water backdrop, light
 * shafts and marine snow. Ported from the S1 seabed viewer handoff (17 Nov 2026) so the app renders those
 * scenes the way the artist tuned them. Values are theirs; see the handoff document before changing any.
 */

// Kiel Bight colour: blue is absorbed about as strongly as red, so what survives 10-20 m down is olive-green.
export const LOOK = {
  fogDensity: new Vector3(0.22, 0.115, 0.24),
  fogLow: new Color('#2e573c'),
  fogHigh: new Color('#4c8160'),
  sunDir: new Vector3(-0.42, 1.0, 0.2).normalize(),
  sunColor: new Color('#f0e294'),
  sunIntensity: 2.0,
  hemiIntensity: 0.95,
  shadowIntensity: 0.85,
  exposure: 1.05,
  bottomFog: new Vector2(0.22, 0.6),
  silt: new Color('#33402a'),
  causticScale: 2.4,
  causticStrength: 0.75,
  /** Full fog by this distance (m). The scene's chapters are spaced on it. */
  visibility: 12.5,
};

/** Shared uniforms for every water-aware shader. */
export function createUniforms() {
  return {
    uTime: { value: 0 },
    uFogOn: { value: 1 },
    uFogDensity: { value: LOOK.fogDensity },
    uFogLow: { value: LOOK.fogLow },
    uFogHigh: { value: LOOK.fogHigh },
    uSunDir: { value: LOOK.sunDir },
    uCaustics: { value: LOOK.causticStrength },
    uCausticScale: { value: LOOK.causticScale },
    uFar: { value: new Vector2(3.5, LOOK.visibility) },
    uBottom: { value: LOOK.bottomFog },
    uSilt: { value: LOOK.silt },
    uCausticTex: { value: null as WebGLRenderTarget['texture'] | null },
    uCausticCenter: { value: new Vector2(0.4, 0.3) },
    uLineWidth: { value: 0.32 },
    uCausticGain: { value: 4.2 },
    uCausticSize: { value: 12.0 },
    uPools: { value: 1.0 },
    uGlow: { value: 0.3 },
    uShadowLift: { value: 0.0 },
    uSat: { value: 1.0 },
    uSurfSat: { value: 1.0 },
    uContrast: { value: 1.3 },
    uCausticBlur: { value: 3.2 },
    uFocus: {
      value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()],
    },
    uFocusFloor: { value: 0.6 },
    uFocusBoost: { value: 1.3 },
    uFocusCaustic: { value: 0.45 },
  } satisfies Record<string, IUniform>;
}
export type WaterUniforms = ReturnType<typeof createUniforms>;

const WATER_GLSL = /* glsl */ `
uniform float uTime, uFogOn, uCaustics, uCausticScale, uCausticSize, uLineWidth, uCausticGain;
uniform vec3 uFogDensity, uFogLow, uFogHigh, uSunDir, uSilt;
uniform vec2 uFar, uBottom, uCausticCenter;
uniform float uSat, uSurfSat, uContrast, uCausticBlur, uPools, uGlow, uShadowLift;
uniform vec4 uFocus[4];
uniform float uFocusFloor, uFocusBoost, uFocusCaustic;
float heroFocus(vec3 wp) {
  float f = 0.0;
  for (int i = 0; i < 4; i++) {
    float r = uFocus[i].w;
    if (r <= 0.0) continue;
    vec2 d = wp.xz - uFocus[i].xz;
    float wob = 1.0 + 0.18 * sin(uTime * 0.23 + float(i) * 1.7 + atan(d.y, d.x) * 2.0)
                    + 0.10 * sin(uTime * 0.41 + float(i) * 2.9);
    f = max(f, exp(-dot(d, d) / (r * r * wob * wob)));
  }
  return f;
}
vec3 desat(vec3 c, float s) { return mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, s); }
vec3 grade(vec3 c) { return 0.18 * pow(max(c, vec3(0.0)) / 0.18, vec3(uContrast)); }
uniform sampler2D uCausticTex;
vec3 waterColor(vec3 dir) {
  float up = smoothstep(-0.25, 0.9, dir.y);
  vec3 c = mix(uFogLow, uFogHigh, up);
  c += uFogHigh * uGlow * pow(max(dot(dir, uSunDir), 0.0), 8.0);
  return c;
}
vec3 applyWater(vec3 col, vec3 worldPos) {
  vec3 v = worldPos - cameraPosition;
  float d = length(v);
  vec3 f = 1.0 - exp(-uFogDensity * d);
  f = max(f, vec3(smoothstep(uFar.x, uFar.y, d)));
  float H = uBottom.y, hA = max(cameraPosition.y, 0.0), hB = max(worldPos.y, 0.0), dh = hB - hA;
  float avgE = abs(dh) < 1e-3 ? exp(-hA / H) : H * (exp(-hA / H) - exp(-hB / H)) / dh;
  float fb = 1.0 - exp(-uBottom.x * avgE * d);
  float siltK = fb * 0.6 * (1.0 - smoothstep(uFar.x * 0.6, uFar.y * 0.75, d));
  vec3 fogCol = desat(mix(waterColor(v / max(d, 1e-4)), uSilt, siltK), uSat);
  float lift = smoothstep(0.6, 6.0, d) * uShadowLift * uFogOn;
  col = max(col, mix(col, fogCol * 0.85, lift));
  f = 1.0 - (1.0 - f) * (1.0 - fb);
  return mix(desat(col, uSurfSat), fogCol, f * uFogOn);
}
vec2 h2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y);
}
vec3 causticLight(vec3 wp) {
  vec2 p = wp.xz - uSunDir.xz / max(uSunDir.y, 0.2) * wp.y;
  vec2 uv = (p - uCausticCenter) / uCausticSize + 0.5;
  float edge = smoothstep(0.0, 0.08, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  vec3 c = texture(uCausticTex, uv, uCausticBlur).rgb * 3.0 * uCausticGain;
  float patchy = smoothstep(0.25, 0.75, vnoise(p * 0.22 + vec2(uTime * 0.02, -uTime * 0.015)));
  float hf = heroFocus(wp);
  float amt = uCaustics * (0.35 + 0.65 * patchy) * edge * mix(uFocusCaustic, 1.0, hf);
  vec2 pd = vec2(uTime * 0.05, -uTime * 0.035);
  float pool = vnoise(p * 0.9 + pd) * 0.65 + vnoise(p * 2.1 - pd * 1.4) * 0.35;
  float poolMul = mix(1.0, 0.25 + 1.6 * smoothstep(0.25, 0.8, pool), uPools);
  poolMul = mix(poolMul, max(poolMul, 1.1), hf);
  return mix(vec3(1.0), 0.55 + c * 2.2, amt) * poolMul * mix(uFocusFloor, uFocusBoost, hf);
}`;

// Caustics modulate the sun itself, evaluated once before the light loop, so shadowed areas get none.
const DIRECTIONAL_HOOK =
  'getDirectionalLightInfo( directionalLight, directLight );';
const LIGHTS_WITH_CAUSTICS =
  'vec3 gCaustic = causticLight( vWPos );\n' +
  ShaderChunk.lights_fragment_begin.replace(
    DIRECTIONAL_HOOK,
    `${DIRECTIONAL_HOOK}\n\t\tdirectLight.color *= gCaustic;`,
  );
if (!ShaderChunk.lights_fragment_begin.includes(DIRECTIONAL_HOOK))
  console.warn('[scene] Caustics: the light chunk hook was not found');

const CAUSTIC_PATTERN_GLSL = /* glsl */ `
float softBorder(vec2 x, float t, float K) {
  vec2 n = floor(x), f = fract(x);
  float f1 = 8.0, acc = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j), o = 0.5 + 0.42 * sin(t + 6.2831 * h2(n + g));
    float d = length(g + o - f);
    f1 = min(f1, d);
    acc += exp(-K * d);
  }
  return K * f1 + log(acc);
}
float roundLine(float e) {
  float fw = max(fwidth(e), uLineWidth);
  float lo = 0.46 - fw, hi = 0.69 + fw;
  float core = smoothstep(lo, hi, e) * (0.23 / (hi - lo));
  float glow = smoothstep(0.18 - fw, 0.69 + fw, e);
  return core * 1.15 + glow * 0.45;
}
float causticLayer(vec2 p) {
  float t = uTime;
  vec2 flow = vec2(t * 0.06, t * 0.035);
  vec2 warp = vec2(vnoise(p * 0.6 + t * 0.07), vnoise(p * 0.6 + 7.3 - t * 0.06)) - 0.5;
  vec2 fine = vec2(vnoise(p * 2.3 - t * 0.11), vnoise(p * 2.3 + 3.9 + t * 0.09)) - 0.5;
  vec2 q = (p + flow) * uCausticScale + warp * 1.8 + fine * 0.45;
  float a = roundLine(softBorder(q, t * 0.55, 16.0));
  float b = roundLine(softBorder(q * 1.6 + 4.1 - flow * 0.7, t * 0.75 + 1.7, 18.0));
  return a * 0.55 + b * 0.35 + a * b * 1.6;
}`;

const SAND_MAP_GLSL = /* glsl */ `#include <map_fragment>
  float sDist = length(vWPos - cameraPosition);
  float sandK = 1.0 - smoothstep(1.2, 4.5, sDist);
  vec2 sp = vWPos.xz;
  float mac = vnoise(sp * 0.33 + 3.1) * 0.6 + vnoise(sp * 0.85 + 7.7) * 0.4;
  float mot = vnoise(sp * 3.1 + 1.3) * 0.6 + vnoise(sp * 7.3 + 5.1) * 0.4;
  vec3 mudTint = vec3(0.60, 0.60, 0.50), cleanTint = vec3(1.14, 1.10, 0.96);
  diffuseColor.rgb *= mix(mudTint, cleanTint, smoothstep(0.28, 0.78, mac)) * (0.86 + 0.28 * mot);
  float hashK = (1.0 - smoothstep(3.0, 6.5, sDist)) * (0.35 + 0.65 * smoothstep(0.35, 0.8, mac));
  if (hashK > 0.0) {
    for (int layer = 0; layer < 2; layer++) {
      float sc = layer == 0 ? 11.0 : 23.0;
      float ang = layer == 0 ? 0.61 : 2.17;
      mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
      vec2 g = R * sp * sc + float(layer) * 31.7, gn = floor(g), gf = fract(g);
      float hh = h1(gn + 17.0);
      if (hh < (layer == 0 ? 0.70 : 0.60)) continue;
      vec2 o = 0.25 + 0.5 * h2(gn);
      float a2 = h1(gn + 5.0) * 6.283;
      vec2 q = mat2(cos(a2), -sin(a2), sin(a2), cos(a2)) * (gf - o);
      q.y *= 1.6 + 1.6 * h1(gn + 9.0);
      q.x *= 1.0 + 0.4 * sin(q.y * 9.0 + hh * 20.0);
      float rr = length(q), sz = 0.09 + 0.14 * h1(gn + 3.0);
      float fw = fwidth(rr) * 1.5;
      float m = 1.0 - smoothstep(sz - fw, sz + fw, rr);
      vec3 speck = h1(gn + 41.0) > 0.45 ? vec3(1.6, 1.55, 1.35) : vec3(0.58, 0.55, 0.47);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * speck, m * hashK * (0.6 + 0.4 * h1(gn + 7.0)));
    }
  }
  diffuseColor.rgb *= mix(1.0, 0.84 + 0.32 * vnoise(sp * 48.0 + 13.0) * vnoise(sp * 9.0), sandK);`;

const SAND_NORMAL_GLSL = /* glsl */ `#include <normal_fragment_maps>
  if (sandK > 0.0) {
    const float se = 0.006;
    float g0 = vnoise(sp * 70.0) * 0.6 + vnoise(sp * 160.0) * 0.4;
    float gx = vnoise((sp + vec2(se, 0.0)) * 70.0) * 0.6 + vnoise((sp + vec2(se, 0.0)) * 160.0) * 0.4;
    float gz = vnoise((sp + vec2(0.0, se)) * 70.0) * 0.6 + vnoise((sp + vec2(0.0, se)) * 160.0) * 0.4;
    vec3 dn = vec3(-(gx - g0), 0.0, -(gz - g0)) / se * 0.0045;
    normal = normalize(normal + (viewMatrix * vec4(dn, 0.0)).xyz * sandK);
  }`;

export interface WaterizeOptions {
  /** Bends instanced plants with the current: amount x height squared. */
  sway?: number;
  /** Close-up sand grain, mud patches and shell hash. */
  sand?: boolean;
}

/** Patches a glTF standard material with the shared water code. Only four shader variants exist. */
export function waterize(
  material: MeshStandardMaterial,
  uniforms: WaterUniforms,
  { sway = 0, sand = false }: WaterizeOptions = {},
) {
  const uSway = { value: sway };
  material.dithering = true;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms, { uSway });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;\nuniform float uTime, uSway;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (uSway > 0.0) {
          float ph = 0.0;
          #ifdef USE_INSTANCING
            ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
          #endif
          float hh = max(position.y, 0.0); hh *= hh;
          transformed.x += uSway * hh * sin(uTime * 1.1 + ph);
          transformed.z += uSway * 0.5 * hh * sin(uTime * 0.8 + ph * 1.3);
        }`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWPos = (modelMatrix * wp4).xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vWPos; varying vec3 vWN;\n${WATER_GLSL}`,
      )
      .replace('#include <lights_fragment_begin>', LIGHTS_WITH_CAUSTICS);
    if (sand)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_fragment>', SAND_MAP_GLSL)
        .replace('#include <normal_fragment_maps>', SAND_NORMAL_GLSL);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `outgoingLight = grade(applyWater(outgoingLight, vWPos));
      #include <opaque_fragment>`,
    );
  };
  material.customProgramCacheKey = () =>
    sway > 0 ? 'water-sway' : sand ? 'water-sand' : 'water';
  material.needsUpdate = true;
}

/**
 * Everything in the water that isn't the scene's own models: caustics, backdrop, lights, light shafts and
 * marine snow. `setStage` moves it to the chapter the camera is in.
 */
export function createWater(
  renderer: WebGLRenderer,
  scene: Scene,
  uniforms: WaterUniforms,
  mobile: boolean,
) {
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  // Caustics: drawn once a frame into a 12 x 12 m world-space texture that every surface samples. Phones
  // get a quarter of the texels, no colour fringing and every other frame.
  const causticTarget = own(
    new WebGLRenderTarget(mobile ? 512 : 1024, mobile ? 512 : 1024, {
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
    }),
  );
  uniforms.uCausticTex.value = causticTarget.texture;
  if (mobile) uniforms.uCausticBlur.value -= 1.0;
  const causticScene = new Scene();
  const causticPass = new Mesh(
    own(new PlaneGeometry(2, 2)),
    own(
      new ShaderMaterial({
        uniforms,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
        vertexShader:
          'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `${WATER_GLSL}${CAUSTIC_PATTERN_GLSL}
          varying vec2 vUv;
          void main() {
            vec2 p = uCausticCenter + (vUv - 0.5) * uCausticSize;
            vec2 disp = vec2(0.004, 0.003);
            vec3 c = ${mobile ? 'vec3(causticLayer(p))' : 'vec3(causticLayer(p + disp), causticLayer(p), causticLayer(p - disp))'};
            gl_FragColor = vec4(clamp(c / 3.0, 0.0, 1.0), 1.0);
          }`,
      }),
    ),
  );
  causticPass.frustumCulled = false;
  causticScene.add(causticPass);
  const causticCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let causticFrame = 0;

  const group = new Group();

  // Backdrop: the water colour in every direction, so there is no horizon line.
  const sky = new Mesh(
    own(new SphereGeometry(60, 32, 16)),
    own(
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        uniforms,
        vertexShader:
          'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `${WATER_GLSL}
          varying vec3 vDir;
          void main(){
            gl_FragColor = vec4(grade(desat(waterColor(normalize(vDir)), uSat)), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            gl_FragColor.rgb += (h1(gl_FragCoord.xy) - 0.5) / 255.0;
          }`,
      }),
    ),
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  group.add(sky);

  // Reflections on metal: the same water colours, prefiltered.
  const envScene = new Scene();
  envScene.add(
    new Mesh(
      sky.geometry,
      new ShaderMaterial({
        side: BackSide,
        uniforms,
        vertexShader: (sky.material as ShaderMaterial).vertexShader,
        fragmentShader: `${WATER_GLSL}
          varying vec3 vDir;
          void main(){ gl_FragColor = vec4(waterColor(normalize(vDir)), 1.0); }`,
      }),
    ),
  );
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = own(pmrem.fromScene(envScene, 0.04));
  pmrem.dispose();
  (
    envScene.children[0] as Mesh<BufferGeometry, ShaderMaterial>
  ).material.dispose();
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.7;

  const sun = new DirectionalLight(LOOK.sunColor, LOOK.sunIntensity);
  sun.castShadow = !mobile;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.intensity = LOOK.shadowIntensity;
  Object.assign(sun.shadow.camera, {
    left: -5,
    right: 5,
    top: 5,
    bottom: -5,
    near: 1,
    far: 25,
  });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 7;
  group.add(
    sun,
    sun.target,
    new HemisphereLight(0x8a9a52, 0x2a2a16, LOOK.hemiIntensity),
  );

  // Light shafts: four soft additive cones along the sun.
  const shafts = new Group();
  const shaftMaterial = own(
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uTime: uniforms.uTime,
        uColor: { value: new Color('#5fb3a3') },
      },
      vertexShader: `varying vec2 vUv; varying float vFacing;
        void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0); vFacing = abs(dot(n, normalize(-mv.xyz)));
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying float vFacing;
        void main(){ float along = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
          float flick = 0.75 + 0.25 * sin(uTime * 0.7 + vUv.x * 40.0);
          float a = pow(vFacing, 3.0) * along * flick * 0.05;
          gl_FragColor = vec4(uColor * a, 1.0); }`,
    }),
  );
  const up = new Vector3(0, 1, 0);
  (
    [
      [1.6, 0.4, -1.2, 0.2],
      [0.6, 0.8, -2.2, 0.35],
      [2.4, 0.5, -0.4, 0.25],
      [-1.2, 0.6, -2.8, 0.3],
    ] as const
  ).forEach(([x, radiusTop, z, radiusBottom], i) => {
    const shaft = new Mesh(
      own(new CylinderGeometry(radiusTop, radiusBottom * 5, 12, 24, 1, true)),
      shaftMaterial,
    );
    shaft.position.set(x, 5.5, z);
    shaft.quaternion.setFromUnitVectors(up, LOOK.sunDir);
    shaft.position.addScaledVector(LOOK.sunDir, 0.5 * i);
    shafts.add(shaft);
  });
  group.add(shafts);

  // Marine snow: faint olive-grey flecks, mostly tiny, visible mainly close to the eye.
  const SNOW = 1500;
  const snowGeometry = own(new BufferGeometry());
  const positions = new Float32Array(SNOW * 3);
  const seeds = new Float32Array(SNOW);
  for (let i = 0; i < SNOW; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = Math.random() * 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
    seeds[i] = Math.random();
  }
  snowGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  snowGeometry.setAttribute('seed', new BufferAttribute(seeds, 1));
  const snow = new Points(
    snowGeometry,
    own(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
        uniforms: { ...uniforms, uPR: { value: renderer.getPixelRatio() } },
        vertexShader: `uniform float uTime, uPR; attribute float seed; varying float vFade; varying vec3 vW;
          void main(){ vec3 p = position;
            p.y = mod(p.y - uTime * (0.008 + 0.012 * seed), 4.0);
            p.x += sin(uTime * 0.21 + seed * 40.0) * 0.10; p.z += cos(uTime * 0.17 + seed * 31.0) * 0.10;
            vW = (modelMatrix * vec4(p, 1.0)).xyz;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float d = -mv.z;
            vFade = (1.0 - smoothstep(1.5, 6.0, d)) * smoothstep(0.0, 0.4, p.y) * smoothstep(0.15, 0.5, d);
            float big = pow(seed, 6.0);
            gl_PointSize = (0.9 + 3.2 * big) * uPR * (3.2 / max(d, 0.4));
            gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `${WATER_GLSL}
          varying float vFade; varying vec3 vW;
          void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, r) * vFade * 0.38;
            vec3 v = vW - cameraPosition; float d = length(v);
            vec3 floc = vec3(0.30, 0.31, 0.24);
            vec3 col = mix(floc, waterColor(v / max(d, 1e-4)), 1.0 - exp(-0.35 * d));
            gl_FragColor = vec4(grade(col), a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    ),
  );
  snow.frustumCulled = false;
  group.add(snow);
  scene.add(group);

  const causticOrigin = uniforms.uCausticCenter.value.clone();

  return {
    /** Moves the light, shafts, snow and caustic texture to a chapter's centre. */
    setStage(centre: Vector3) {
      shafts.position.set(centre.x, 0, centre.z);
      snow.position.set(centre.x, 0, centre.z);
      sun.position.copy(LOOK.sunDir).multiplyScalar(10).add(centre);
      sun.target.position.copy(centre);
      sun.target.updateMatrixWorld();
      uniforms.uCausticCenter.value.set(
        causticOrigin.x + centre.x,
        causticOrigin.y + centre.z,
      );
    },
    renderCaustics() {
      if (uniforms.uCaustics.value <= 0) return;
      if (mobile && causticFrame++ & 1) return;
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(causticTarget);
      renderer.render(causticScene, causticCamera);
      renderer.setRenderTarget(previous);
    },
    dispose() {
      scene.remove(group);
      scene.environment = null;
      for (const item of disposables) item.dispose();
    },
  };
}
