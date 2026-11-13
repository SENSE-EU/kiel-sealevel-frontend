/** Per-scene look. Free of Three.js imports, so the UI can use the tints without loading it. */
export interface SceneTheme {
  kind: 'munitions' | 'seagrass' | 'reef';
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
  seagrass: {
    kind: 'seagrass',
    skyTop: 0x0c3b3e,
    skyBottom: 0x0f4a46,
    fog: 0x1b6a58,
    floor: 0x7cc66f,
    sun: 0xd8f2d0,
    fish: 0x5fd0b8,
    tint: '#1a6b4f',
    backdrop: 'linear-gradient(#0c3b3e 25%, #1b6a58 45%, #7cc66f)',
  },
  reef: {
    kind: 'reef',
    skyTop: 0x123448,
    skyBottom: 0x164258,
    fog: 0x24606e,
    floor: 0x74aeaa,
    sun: 0xcfe6ea,
    fish: 0x6fbfd8,
    tint: '#1c5a78',
    backdrop: 'linear-gradient(#123448 40%, #24606e 50%, #74aeaa)',
  },
};

/** The slug decides the look; unknown scenes get the munitions theme. */
export function themeForSlug(slug: string): SceneTheme {
  if (slug.includes('reef') || slug.includes('stone')) return THEMES.reef;
  if (slug.includes('biodiversity') || slug.includes('seagrass'))
    return THEMES.seagrass;
  return THEMES.munitions;
}
