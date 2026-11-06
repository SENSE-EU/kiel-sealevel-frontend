/** Per-scene look. Free of Three.js imports, so the UI can use the tints without loading it. */
export interface SceneTheme {
  kind: 'munitions';
  skyTop: number;
  skyBottom: number;
  fog: number;
  floor: number;
  sun: number;
  fish: number;
  /** CSS gradient colours for cards, tray thumbnails and the pre-WebGL backdrop. */
  tint: string;
  backdrop: string;
}

const THEMES: Record<SceneTheme['kind'], SceneTheme> = {
  munitions: {
    kind: 'munitions',
    skyTop: 0x0e2a33,
    skyBottom: 0x112f3a,
    fog: 0x1c4a58,
    floor: 0x5f9c94,
    sun: 0xbcd9dc,
    fish: 0x6fb4d0,
    tint: '#1c5a78',
    backdrop: 'linear-gradient(#0e2a33 40%, #1c4a58 55%, #5f9c94)',
  },
};

/** The demo has one scene, so it has one look. The per-scene themes live on the v2 branch. */
export const SCENE_THEME = THEMES.munitions;
