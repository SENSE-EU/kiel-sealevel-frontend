import type { ScenePackage } from './scenePackage';

/**
 * 3D team deliveries served with the app until the CMS can hold a multi-file scene. The files live in
 * `public/local/scenes/<slug>/`; when they are there, the app uses them for that scene instead of the CMS model.
 */
const LOCAL_PACKAGES: Record<string, ScenePackage> = {
  // S1 seabed viewer, version of 25 Nov 2026: the dump site and, 20 m away, the moored mine.
  munitions: {
    root: '/local/scenes/munitions/',
    base: 'seabed_scene.glb',
    chapters: [
      { id: 'dump-site', centre: [0, 0, 0] },
      { id: 'mine', centre: [0, 0, -20], pack: 'chapter_mine.glb' },
    ],
    vegetation: {
      meshes: 'vegetation.glb',
      instances: 'vegetation_instances.json',
    },
    detail: [
      { file: 'detail_mine.glb', objects: ['PROP_Mine_01'], radius: 2.2 },
      {
        file: 'detail_casing.glb',
        objects: ['PROP_Shell_155mm_01'],
        radius: 1.4,
      },
    ],
    focus: [
      ['hs_pile', 1.7],
      ['hs_corrosion', 0.8],
      ['hs_lifting', 1.45],
      ['hs_munimar', 1.2],
    ],
    plume: {
      casing: 'PROP_Shell_155mm_01',
      hotspot: 'hs_corrosion',
      direction: [0.96, -0.27],
      width: 0.06,
      length: 3.0,
      label: {
        en: ['Dissolved TNT', 'made visible · invisible in reality'],
        de: ['Gelöstes TNT', 'sichtbar gemacht · in Wirklichkeit unsichtbar'],
      },
    },
    // Placeholder vehicle until GEOMAR provides a real model. Lane 2 passes the hotspot 3 view, lane 3
    // runs over the mine; 1.7 m up clears the mine's horns.
    survey: {
      chapter: 'mine',
      hotspot: 'hs_survey',
      lanes: [-5.6, -3.1, -0.6, 1.9],
      from: -5.5,
      to: 5.5,
      height: 1.7,
      speed: 1.0,
      halfWidth: 1.6,
      label: {
        en: ['Multibeam sonar', 'sound, made visible · maps the seabed'],
        de: [
          'Fächerecholot',
          'Schall, sichtbar gemacht · kartiert den Meeresboden',
        ],
      },
    },
    // The CMS content uses the generic anchors; these are the model's names for them. vp_4 (the bubble
    // curtain's viewpoint) is in the model but not in the CMS yet.
    anchorAliases: {
      vp_1: 'vp_pile',
      vp_2: 'vp_casing',
      vp_3: 'vp_survey',
      hs_1: 'hs_pile',
      hs_2: 'hs_corrosion',
      hs_3: 'hs_survey',
      hs_4: 'hs_lifting',
      hs_5: 'hs_curtain',
      hs_6: 'hs_munimar',
      vp_4: 'vp_curtain',
    },
  },
};

/** The local package for a scene, if its files are on this machine. */
export async function findLocalPackage(
  slug: string,
): Promise<ScenePackage | null> {
  const pkg = LOCAL_PACKAGES[slug];
  if (!pkg) return null;
  try {
    const response = await fetch(pkg.root + pkg.base, { method: 'HEAD' });
    // The dev server and nginx answer a missing file with the app's index.html.
    const type = response.headers.get('content-type') ?? '';
    return response.ok && !type.includes('text/html') ? pkg : null;
  } catch {
    return null;
  }
}
