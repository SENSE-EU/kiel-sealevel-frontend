import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
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
  RepeatWrapping,
  Scene,
  ShaderChunk,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  NoColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type IUniform,
  type MeshStandardMaterial,
  type PerspectiveCamera,
  type Texture,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';

/**
 * Baltic water for the 3D team's scenes: per-channel light absorption, bottom murk, caustics drawn once a
 * frame into a world-space texture, a hero spotlight on each chapter's subject, a water backdrop, light
 * shafts, marine snow, the baked algal turf on the sea floor, and the "made visible" layers for the dissolving
 * explosive and the survey sonar. Ported from the S1 seabed viewer (version of 25 Nov 2026) so the app renders
 * those scenes the way the artist tuned them. Values are theirs; see the handoff document before changing any.
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
  causticStrength: 0.5,
  floc: new Color('#4d4f42'),
  /** Full fog by this distance (m). The scene's chapters are spaced on it. */
  visibility: 12.5,
};

const TURF_POINTS = 32;

/** Shared uniforms for every water-aware shader. `root` is where the turf detail textures are served from. */
export function createUniforms(root: string) {
  const loader = new TextureLoader();
  const turf = (file: string, srgb: boolean) => {
    const texture = loader.load(root + file);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    texture.anisotropy = 8;
    return texture;
  };
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
    uCausticBlur: { value: 3.0 },
    uFloc: { value: LOOK.floc },
    uFocus: {
      value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()],
    },
    uFocusFloor: { value: 0.6 },
    uFocusBoost: { value: 1.3 },
    uFocusCaustic: { value: 0.45 },
    // Algal turf thickens around the munitions: xyz = footprint centre, w = radius (m), 0 = unused.
    uTurfPts: {
      value: Array.from({ length: TURF_POINTS }, () => new Vector4()),
    },
    uTurfCol: { value: turf('tex/T_Turf_BaseColor.webp', true) as Texture },
    uTurfNrm: { value: turf('tex/T_Turf_Normal.webp', false) as Texture },
    uTurfORM: { value: turf('tex/T_Turf_ORM.webp', false) as Texture },
    // Dissolved explosive leaving the open casing: xyz = source, w = shown 0..1. uPlumeDir: xy = current
    // direction (xz), z = width at the source, w = length (m). uPlumeH: sea floor height along the trail.
    uPlume: { value: new Vector4() },
    uPlumeDir: { value: new Vector4(1, 0, 0.06, 3.0) },
    uPlumeH: { value: new Array<number>(8).fill(0) },
    uPlumeAxis: { value: new Vector3(0, 0, 1) },
    // The survey AUV's multibeam swath: xyz = AUV position, w = shown 0..1. uScanDir: xy = heading (xz),
    // z = swath half-width on the floor, w = trail fade length (m).
    uScan: { value: new Vector4() },
    uScanDir: { value: new Vector4(1, 0, 1.8, 4.0) },
  } satisfies Record<string, IUniform>;
}
export type WaterUniforms = ReturnType<typeof createUniforms>;

export const WATER_GLSL = /* glsl */ `
uniform float uTime, uFogOn, uCaustics, uCausticScale, uCausticSize, uLineWidth, uCausticGain;
uniform vec3 uFogDensity, uFogLow, uFogHigh, uSunDir, uSilt;
uniform vec2 uFar, uBottom, uCausticCenter;
uniform float uSat, uSurfSat, uContrast, uCausticBlur, uPools, uGlow, uShadowLift;
uniform vec4 uFocus[4];
uniform float uFocusFloor, uFocusBoost, uFocusCaustic;
uniform vec4 uTurfPts[32];
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
  if (uFogOn == 0.0) return desat(col, uSurfSat);
  vec3 v = worldPos - cameraPosition;
  float d = length(v);
  if (d >= uFar.y) return desat(waterColor(v / d), uSat);
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
float vnoiseQ(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y);
}
// The dissolved explosive, 0..1 at a world point: a bottom-hugging trail from the casing mouth, carried
// down-current, widening and thinning, with a slow texture drifting along it. A "made visible" overlay.
uniform vec4 uPlume, uPlumeDir;
uniform float uPlumeH[8];
float plumeGround(float s) {
  float x = clamp(s / uPlumeDir.w, 0.0, 1.0) * 7.0;
  int i = int(min(floor(x), 6.0));
  float a = uPlumeH[0];
  for (int k = 0; k < 7; k++) if (k == i) a = mix(uPlumeH[k], uPlumeH[k + 1], x - float(k));
  return a;
}
float plumeConc(vec3 wp) {
  if (uPlume.w <= 0.0) return 0.0;
  vec2 dir = uPlumeDir.xy, p = wp.xz - uPlume.xz;
  float s = dot(p, dir), n = p.x * dir.y - p.y * dir.x, L = uPlumeDir.w;
  if (s < -0.2 || s > L) return 0.0;
  float sc = max(s, 0.0);
  n += 0.08 * sc * sin(sc * 1.7 - uTime * 0.12);
  float w = uPlumeDir.z + 0.13 * sc;
  float across = exp(-(n * n) / (w * w));
  float along = smoothstep(-0.04, 0.10, s) * exp(-sc / (0.4 * L)) * (1.0 - smoothstep(0.65 * L, L, s));
  float flow = vnoise(vec2(sc * 3.0 - uTime * 0.22, n * 5.0)) * 0.6 + vnoise(vec2(sc * 7.0 - uTime * 0.40, n * 11.0 + 3.1)) * 0.4;
  float top = max(plumeGround(s), uPlume.y) + 0.25;
  float vk = 1.0 - smoothstep(top - 0.15, top, wp.y);
  return uPlume.w * across * along * vk * (0.25 + 0.75 * flow);
}
vec3 causticLight(vec3 wp) {
  vec2 p = wp.xz - uSunDir.xz / max(uSunDir.y, 0.2) * wp.y;
  float hf = heroFocus(wp);
  vec3 pattern = vec3(1.0);
  if (uCaustics > 0.0) {
    vec2 uv = (p - uCausticCenter) / uCausticSize + 0.5;
    float edge = smoothstep(0.0, 0.08, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    vec3 c = texture(uCausticTex, uv, uCausticBlur).rgb * 3.0 * uCausticGain;
    float patchy = smoothstep(0.25, 0.75, vnoise(p * 0.22 + vec2(uTime * 0.02, -uTime * 0.015)));
    float amt = uCaustics * (0.35 + 0.65 * patchy) * edge * mix(uFocusCaustic, 1.0, hf);
    pattern = mix(pattern, 0.55 + c * 2.2, amt);
  }
  // Large soft pools of light drifting: the sharp net seen through 15 m of water. Each octave on its own
  // rotated grid, so the pools aren't square.
  vec2 pd = vec2(uTime * 0.05, -uTime * 0.035);
  float pool = vnoiseQ(mat2(0.80, -0.60, 0.60, 0.80) * p * 0.9 + pd) * 0.65
             + vnoiseQ(mat2(0.47, 0.88, -0.88, 0.47) * p * 2.1 - pd * 1.4) * 0.35;
  float poolMul = mix(1.0, 0.25 + 1.6 * smoothstep(0.25, 0.8, pool), uPools);
  poolMul = mix(poolMul, max(poolMul, 1.1), hf);
  return pattern * poolMul * mix(uFocusFloor, uFocusBoost, hf);
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
float causticPattern(vec2 p) {
  float t = uTime;
  vec2 flow = vec2(t * 0.06, t * 0.035);
  vec2 warp = vec2(vnoise(p * 0.6 + t * 0.07), vnoise(p * 0.6 + 7.3 - t * 0.06)) - 0.5;
  vec2 fine = vec2(vnoise(p * 2.3 - t * 0.11), vnoise(p * 2.3 + 3.9 + t * 0.09)) - 0.5;
  vec2 q = (p + flow) * uCausticScale + warp * 1.8 + fine * 0.45;
  return roundLine(softBorder(q, t * 0.55, 16.0));
}`;

// Close-up sand (grain, mud patches, shell hash) and the red-brown algal turf: patchy beds of low bushy reds
// from a baked texture, thicker in ragged halos around the munitions, with sand showing between.
const SAND_PARS_GLSL = /* glsl */ `#include <map_pars_fragment>
uniform sampler2D uTurfCol, uTurfNrm, uTurfORM;`;

const SAND_MAP_GLSL = /* glsl */ `#include <map_fragment>
  float sDist = length(vWPos - cameraPosition);
  float sandK = 1.0 - smoothstep(1.2, 4.5, sDist);
  vec2 sp = vWPos.xz;
  float mac = vnoise(sp * 0.33 + 3.1) * 0.6 + vnoise(sp * 0.85 + 7.7) * 0.4;
  float mot = vnoise(sp * 3.1 + 1.3) * 0.6 + vnoise(sp * 7.3 + 5.1) * 0.4;
  vec3 mudTint = vec3(0.60, 0.60, 0.50), cleanTint = vec3(1.14, 1.10, 0.96);
  diffuseColor.rgb *= mix(mudTint, cleanTint, smoothstep(0.28, 0.78, mac)) * (0.86 + 0.28 * mot);
  float small = vnoise(sp * 2.4 + 11.3) * 0.6 + vnoise(sp * 5.5 + 4.2) * 0.3 + vnoise(sp * 12.0 + 2.9) * 0.1;
  float grp = smoothstep(0.38, 0.68, vnoise(sp * 0.35 + 7.9) * 0.75 + vnoise(sp * 0.9 + 3.1) * 0.25);
  float tbed = small * mix(0.55, 1.12, grp);
  float near = 0.0;
  for (int i = 0; i < 32; i++) {
    vec4 tp = uTurfPts[i];
    if (tp.w <= 0.0) continue;
    float dw = length(sp - tp.xz) + (vnoise(sp * 3.3 + float(i) * 1.7) - 0.5) * 0.55 * tp.w;
    near = max(near, 1.0 - smoothstep(tp.w * 0.15, tp.w, dw));
  }
  float nbreak = smoothstep(0.42, 0.62, vnoise(sp * 4.5 + 1.7) * 0.6 + vnoise(sp * 11.0 + 3.3) * 0.4);
  near *= mix(0.35, 1.0, nbreak);
  float tdense = smoothstep(0.30, 0.65, vnoise(sp * 0.8 + 21.7) * 0.7 + 0.3 * vnoise(sp * 3.1 + 4.4)) * 0.75 + 0.25 * near;
  vec2 tuv1 = sp * 2.0;
  vec2 tuv2 = mat2(0.80, -0.60, 0.60, 0.80) * sp * 1.43 + vec2(0.37, 0.71);
  float tmix = smoothstep(0.3, 0.7, vnoise(sp * 0.9 + 6.1));
  vec4 tcol = mix(texture2D(uTurfCol, tuv1), texture2D(uTurfCol, tuv2), tmix);
  vec4 torm = mix(texture2D(uTurfORM, tuv1), texture2D(uTurfORM, tuv2), tmix);
  float tcov = smoothstep(0.02, 0.06, dot(tcol.rgb, vec3(0.3, 0.5, 0.2)));
  float tl = clamp(dot(tcol.rgb, vec3(0.45, 0.4, 0.15)) * 7.0, 0.0, 1.0);
  float dens = smoothstep(0.40, 0.66, tbed + 0.55 * near);
  float th = clamp(0.55 * tl + 0.45 * torm.r, 0.0, 1.0) * tcov;
  float turfM = smoothstep(1.0 - dens - 0.05, 1.0 - dens + 0.05, th * 0.96 + 0.02);
  turfM *= mix(0.85 + 0.15 * tdense, 1.0, max(tcov, dens * dens));
  vec3 turfCol = mix(vec3(0.050, 0.030, 0.020), vec3(0.15, 0.090, 0.055), tl)
               * (0.6 + 0.4 * torm.r) * mix(1.0, 0.72, tdense * tdense)
               * mix(1.0, 0.7, smoothstep(0.0, 0.6, near));
  diffuseColor.rgb *= 1.12;
  float tv1 = smoothstep(0.15, 0.85, vnoise(sp * 1.8 + 31.7) * 0.6 + vnoise(sp * 4.7 + 13.1) * 0.4);
  float tv2 = vnoise(sp * 2.9 + 51.3);
  turfCol *= 0.3 + 1.7 * tv1 * tv1 + 0.25 * tv1;
  turfCol = mix(turfCol, turfCol * vec3(0.95, 1.55, 1.05), smoothstep(0.50, 0.80, tv2));
  turfCol = mix(turfCol, turfCol * vec3(1.6, 0.75, 0.75), smoothstep(0.45, 0.15, tv2) * 0.9);
  float bush = smoothstep(0.03, 0.2, th);
  float core = smoothstep(0.45, 0.95, dens);
  vec3 gapCol = diffuseColor.rgb * vec3(0.52, 0.43, 0.32);
  gapCol = mix(gapCol, turfCol * 0.45, core);
  float twig = smoothstep(0.35, 0.7, tl) * bush;
  float rsel = smoothstep(0.50, 0.70, vnoise(sp * 3.4 + 17.3) * 0.65 + vnoise(sp * 9.0 + 2.2) * 0.35);
  vec3 redLine = vec3(0.30, 0.035, 0.028) * (0.6 + 0.4 * torm.r);
  float ang = vnoise(sp * 0.7 + 41.0) * 6.283;
  mat2 RL = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 rq = RL * sp;
  float ridge = 1.0 - abs(2.0 * vnoise(vec2(rq.x * 2.4, rq.y * 13.0) + 5.3) - 1.0);
  turfCol = mix(turfCol, redLine, twig * rsel * smoothstep(0.2, 0.6, dens));
  vec3 bedCol = mix(gapCol, turfCol, bush);
  float redP = smoothstep(0.56, 0.72, vnoise(sp * 2.6 + 17.3) * 0.7 + vnoise(sp * 7.5 + 2.2) * 0.3)
             * smoothstep(0.2, 0.6, dens);
  bedCol = mix(bedCol, redLine * 0.38 * (0.6 + 0.6 * tl), redP * (0.25 + 0.45 * bush));
  float strand = smoothstep(0.55, 0.95, ridge) * (0.55 + 0.45 * vnoise(sp * 6.0 + 3.7)) * rsel * smoothstep(0.2, 0.6, dens);
  bedCol = mix(bedCol, redLine * 0.38, strand * 0.6);
  float brownK = smoothstep(0.05, 0.55, dens) * (1.0 - min(1.0, turfM * 1.05));
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.80, 0.70, 0.56), brownK);
  diffuseColor.rgb = mix(diffuseColor.rgb, bedCol, min(1.0, turfM * 1.05));
  float hashK = (1.0 - smoothstep(3.0, 6.5, sDist)) * (0.35 + 0.65 * smoothstep(0.35, 0.8, mac)) * (1.0 - turfM);
  if (hashK > 0.0) {
    for (int layer = 0; layer < 2; layer++) {
      float sc = layer == 0 ? 11.0 : 23.0;
      float la = layer == 0 ? 0.61 : 2.17;
      mat2 R = mat2(cos(la), -sin(la), sin(la), cos(la));
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
    vec3 dn = vec3(-(gx - g0), 0.0, -(gz - g0)) / se * 0.0045 * (1.0 - turfM);
    normal = normalize(normal + (viewMatrix * vec4(dn, 0.0)).xyz * sandK);
  }
  if (turfM > 0.0) {
    vec3 tn = mix(texture2D(uTurfNrm, tuv1).xyz, texture2D(uTurfNrm, tuv2).xyz, tmix) * 2.0 - 1.0;
    float tK = turfM * (1.0 - smoothstep(6.0, 16.0, length(vWPos - cameraPosition)));
    normal = normalize(normal + (viewMatrix * vec4(tn.x, 0.0, tn.y, 0.0)).xyz * 4.0 * tK);
  }`;

// Open-casing interiors: the near-black baked texels inside the tube are lifted to dark silted rust.
const ALBEDO_FLOOR_GLSL = /* glsl */ `#include <map_fragment>
  float darkTexel = uAlbFloor * (1.0 - smoothstep(0.02, 0.09, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))));
  if (uAlbFloor > 0.0) {
    vec3 ap = vWPos - uPlume.xyz;
    float ra = length(cross(ap, uPlumeAxis));
    darkTexel = max(darkTexel, uAlbFloor * (1.0 - smoothstep(0.066, 0.078, ra)) * (1.0 - smoothstep(-0.01, 0.02, dot(ap, uPlumeAxis))));
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, max(diffuseColor.rgb, vec3(0.065, 0.040, 0.024)), darkTexel);`;

// The plume tint (an amber "data layer" on the floor; mussels in it glow at the rim and pulse) and the
// multibeam swath (a cyan scan line sweeping the bottom, leaving a fading depth-coloured map), then water.
const OUTGOING_GLSL = /* glsl */ `
  outgoingLight = mix(outgoingLight, max(outgoingLight, diffuseColor.rgb * 0.7), darkTexel);
  float pK = plumeConc(vWPos) * uPlumeK;
  if (uPlumeK > 1.0 && uPlume.w > 0.0) {
    vec3 dm = vWPos - uPlume.xyz;
    pK = max(pK, uPlume.w * 0.5 * exp(-dot(dm, dm) / 0.16));
  }
  if (pK > 0.0) {
    if (uPlumeK > 1.0) pK *= 0.7 + 0.3 * sin(uTime * 1.6);
    float iso = abs(fract(pK * 2.5 - uTime * 0.08) - 0.5);
    float line = (1.0 - smoothstep(0.0, 0.03 + fwidth(pK * 2.5), iso)) * smoothstep(0.15, 0.4, pK) * step(uPlumeK, 1.0);
    if (uPlumeK > 1.0) {
      float rim = pow(1.0 - clamp(dot(normal, geometryViewDir), 0.0, 1.0), 2.0);
      outgoingLight = mix(outgoingLight, outgoingLight * vec3(1.3, 1.05, 0.75), min(pK, 1.0) * 0.3)
                    + vec3(0.95, 0.52, 0.08) * pK * (0.03 + 0.45 * rim);
    } else {
      outgoingLight = mix(outgoingLight, outgoingLight * vec3(1.25, 1.05, 0.7), min(pK, 1.0) * 0.45)
                    + vec3(0.60, 0.36, 0.05) * (pK * 0.21 + line * 0.07 * uPlume.w);
    }
  }
  if (uScan.w > 0.0 && uScanK > 0.0 && vWPos.y < uScan.y - 0.35) {
    vec2 sq = vWPos.xz - uScan.xz, sdr = uScanDir.xy;
    float al = dot(sq, sdr), ac = sq.x * sdr.y - sq.y * sdr.x;
    float inside = 1.0 - smoothstep(uScanDir.z * 0.85, uScanDir.z, abs(ac));
    if (inside > 0.0 && al < 0.3 && al > -uScanDir.w) {
      float scanLine = exp(-al * al / 0.0012);
      float trail = (1.0 - smoothstep(-0.08, 0.02, al)) * exp(al / (0.45 * uScanDir.w)) * smoothstep(-uScanDir.w, -0.8 * uScanDir.w, al);
      float hb = vWPos.y;
      vec3 bathy = mix(vec3(0.10, 0.30, 0.85), vec3(0.15, 0.80, 0.55), smoothstep(-0.3, 0.15, hb));
      bathy = mix(bathy, vec3(0.95, 0.85, 0.25), smoothstep(0.15, 0.9, hb));
      float cz = abs(fract(hb * 12.0) - 0.5) * 2.0;
      float contour = 1.0 - smoothstep(0.0, 0.12 + fwidth(hb * 12.0) * 2.0, 1.0 - cz);
      float k = inside * uScan.w * uScanK;
      outgoingLight = mix(outgoingLight, outgoingLight * 0.5 + bathy * (0.16 + 0.14 * contour), trail * k * 0.85);
      outgoingLight += vec3(0.45, 0.85, 1.0) * scanLine * k * 0.55;
    }
  }
  outgoingLight = grade(applyWater(outgoingLight, vWPos));
  #include <opaque_fragment>`;

export interface WaterizeOptions {
  /** Bends instanced plants with the current: amount x height squared. */
  sway?: number;
  /** Fish: a side-to-side bend toward the tail. */
  wiggle?: number;
  /** Fish body length (m), for the bend. */
  fishLength?: number;
  /** The sea floor: close-up sand grain, shell hash and the algal turf. */
  sand?: boolean;
}

/**
 * Per-material settings, read when the shader compiles so they can be set after `waterize`:
 * `plumeK` how strongly the plume tints it (floor 1, mussels 2.4, props 0), `albedoFloor` lifts near-black
 * interior texels, `scanK` whether the sonar maps it.
 */
export interface WaterMaterialData {
  plumeK?: number;
  albedoFloor?: number;
  scanK?: number;
}

/** Patches a glTF standard material with the shared water code. */
export function waterize(
  material: MeshStandardMaterial,
  uniforms: WaterUniforms,
  {
    sway = 0,
    wiggle = 0,
    fishLength = 0.055,
    sand = false,
  }: WaterizeOptions = {},
) {
  const uSway = { value: sway };
  const uWiggle = { value: wiggle };
  const uFishLen = { value: fishLength };
  material.dithering = true;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    const data = material.userData as WaterMaterialData;
    Object.assign(shader.uniforms, uniforms, {
      uSway,
      uWiggle,
      uFishLen,
      uPlumeK: { value: data.plumeK ?? (wiggle > 0 ? 0 : sand ? 1 : 0) },
      uAlbFloor: { value: data.albedoFloor ?? 0 },
      uScanK: { value: data.scanK ?? (wiggle > 0 ? 0 : 1) },
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;\nuniform float uTime, uSway, uWiggle, uFishLen;',
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
        }
        if (uWiggle > 0.0) {
          float fph = 0.0;
          #ifdef USE_INSTANCING
            fph = float(gl_InstanceID) * 2.39;
          #endif
          float w = clamp((0.18 * uFishLen - position.x) / (0.64 * uFishLen), 0.0, 1.0);
          transformed.z += uWiggle * w * w * sin(uTime * 13.0 - position.x * (4.95 / uFishLen) + fph);
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
        `#include <common>\nvarying vec3 vWPos; varying vec3 vWN;\n${WATER_GLSL}
        uniform float uPlumeK, uAlbFloor, uScanK; uniform vec3 uPlumeAxis; uniform vec4 uScan, uScanDir;`,
      )
      .replace('#include <lights_fragment_begin>', LIGHTS_WITH_CAUSTICS);
    if (sand)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_pars_fragment>', SAND_PARS_GLSL)
        .replace('#include <map_fragment>', SAND_MAP_GLSL)
        .replace('#include <normal_fragment_maps>', SAND_NORMAL_GLSL);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', ALBEDO_FLOOR_GLSL)
      .replace('#include <opaque_fragment>', OUTGOING_GLSL);
  };
  material.customProgramCacheKey = () =>
    wiggle > 0
      ? 'water-fish'
      : sway > 0
        ? 'water-sway'
        : sand
          ? 'water-sand'
          : 'water';
  material.needsUpdate = true;
}

/**
 * Everything in the water that isn't the scene's own models: caustics, backdrop, lights, light shafts and
 * marine snow. `setStage` moves it to the chapter the camera is in.
 */
export function createWater(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  uniforms: WaterUniforms,
  mobile: boolean,
) {
  const disposables: { dispose(): void }[] = [
    uniforms.uTurfCol.value,
    uniforms.uTurfNrm.value,
    uniforms.uTurfORM.value,
  ];
  const own = <T extends { dispose(): void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  // Caustics: one animated pattern in a 12 x 12 m world-space texture that every surface samples, redrawn
  // at a fixed rate (30 a second, 24 on phones).
  const causticSize = mobile ? 256 : 512;
  const causticInterval = 1 / (mobile ? 24 : 30);
  const causticTarget = own(
    new WebGLRenderTarget(causticSize, causticSize, {
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
            gl_FragColor = vec4(vec3(clamp(causticPattern(p) / 3.0, 0.0, 1.0)), 1.0);
          }`,
      }),
    ),
  );
  causticPass.frustumCulled = false;
  causticScene.add(causticPass);
  const causticCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let nextCaustics = -Infinity;

  const group = new Group();

  // Backdrop: one full-screen triangle at the far plane, drawn after everything else, so it only shades
  // what nothing covered. The water colour in every direction: no horizon line.
  const skyGeometry = own(new BufferGeometry());
  skyGeometry.setAttribute(
    'position',
    new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  const sky = new Mesh(
    skyGeometry,
    own(
      new ShaderMaterial({
        depthWrite: false,
        uniforms: {
          ...uniforms,
          uInverseProjection: { value: camera.projectionMatrixInverse },
        },
        vertexShader: `uniform mat4 uInverseProjection; varying vec3 vDir;
          void main() {
            gl_Position = vec4(position.xy, 1.0, 1.0);
            vec3 viewRay = (uInverseProjection * gl_Position).xyz;
            vDir = transpose(mat3(viewMatrix)) * viewRay;
          }`,
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
  sky.renderOrder = Infinity;
  sky.frustumCulled = false;
  group.add(sky);

  // Reflections on metal: the same water colours, prefiltered.
  const envScene = new Scene();
  const envGeometry = new SphereGeometry(60, 32, 16);
  const envMaterial = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms,
    vertexShader:
      'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${WATER_GLSL}
      varying vec3 vDir;
      void main(){ gl_FragColor = vec4(waterColor(normalize(vDir)), 1.0); }`,
  });
  envScene.add(new Mesh(envGeometry, envMaterial));
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = own(pmrem.fromScene(envScene, 0.04));
  pmrem.dispose();
  envGeometry.dispose();
  envMaterial.dispose();
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

  // Marine snow: pale organic flecks, mostly tiny, a few larger flocs, denser in the lower 3 m, tinted
  // toward the water colour with distance.
  const SNOW = 3000;
  const snowGeometry = own(new BufferGeometry());
  const positions = new Float32Array(SNOW * 3);
  const seeds = new Float32Array(SNOW);
  for (let i = 0; i < SNOW; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = Math.random() * 3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
    seeds[i] = Math.random();
  }
  snowGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  snowGeometry.setAttribute('seed', new BufferAttribute(seeds, 1));
  const snowUniforms = {
    ...uniforms,
    uPR: { value: renderer.getPixelRatio() },
  };
  const snow = new Points(
    snowGeometry,
    own(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
        uniforms: snowUniforms,
        vertexShader: `uniform float uTime, uPR; attribute float seed; varying float vFade; varying vec3 vW;
          void main(){ vec3 p = position;
            p.y = mod(p.y - uTime * (0.008 + 0.012 * seed), 3.0);
            p.x += sin(uTime * 0.21 + seed * 40.0) * 0.10; p.z += cos(uTime * 0.17 + seed * 31.0) * 0.10;
            vW = (modelMatrix * vec4(p, 1.0)).xyz;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float d = -mv.z;
            vFade = (1.0 - smoothstep(2.0, 7.5, d)) * smoothstep(0.0, 0.4, p.y) * smoothstep(0.15, 0.5, d);
            if (vFade <= 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
            float big = pow(seed, 6.0);
            gl_PointSize = (3.0 + 6.0 * big) * uPR * (3.2 / max(d, 0.4));
            gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `${WATER_GLSL}
          uniform vec3 uFloc; varying float vFade; varying vec3 vW;
          void main(){ float r = length(gl_PointCoord - 0.5);
            if (r >= 0.5) discard;
            float a = smoothstep(0.5, 0.15, r) * vFade * 0.8;
            vec3 v = vW - cameraPosition; float d = length(v);
            vec3 col = mix(uFloc * 2.8, waterColor(v / max(d, 1e-4)), 1.0 - exp(-0.22 * d));
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
      nextCaustics = -Infinity;
    },
    renderCaustics() {
      const time = uniforms.uTime.value;
      if (uniforms.uCaustics.value <= 0 || time < nextCaustics) return;
      nextCaustics =
        Math.max(time - causticInterval / 2, nextCaustics) + causticInterval;
      snowUniforms.uPR.value = renderer.getPixelRatio();
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
