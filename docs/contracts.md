# Contracts

What the frontend expects from the 3D pipeline and from Strapi. If either changes, change this file with it.

## Anchors (artist, 3D engineer, CMS)

Hotspots and viewpoints refer to **named nodes in the GLB**. The name is the only link between them, so a
replacement model keeps working as long as it keeps the names.

- Names use only letters, digits, `_` and `-`, and are unique. Three.js strips other characters such as `.` and
  spaces when loading, so `vp.start` would not match a CMS value of `vp.start`.
- Prefix `vp_` for viewpoints and `hs_` for hotspots.
- **Viewpoint node:** an empty or a camera. The visitor's camera takes its position and rotation, looking along the
  node's local -Z (the same way a Blender camera looks).
- **Hotspot node:** a mesh or group, which glows when selected and is framed by the camera, or an empty, which is
  just a point to look at, with no highlight.
- A CMS anchor that isn't in the GLB hides that hotspot or viewpoint and logs a console warning.
- **Look-at partners (optional):** a viewpoint `vp_<name>` with a `vp_<name>_target` node looks at that node
  instead of using its own rotation. A hotspot `hs_<name>` with a `hs_<name>_view` node is framed from that node.
  This is how the 3D team's S1 scene is built.

## Local scene packages

Some deliveries are several files rather than one GLB: the S1 munitions scene (version of 25 Nov 2026) has a base
pack with the sea floor and anchors, a chapter pack for the mine 20 m away, instanced vegetation and fish, close-up
texture packs fetched when the camera gets near the mine or the broken casing, and baked algal-turf textures for
the sea floor (`tex/`). It also brings its own look, ported from the 3D team's viewer in `src/engine/underwater/`:
`water.ts` (Baltic fog, caustics, light shafts, marine snow, the turf), `vegetation.ts` (plants, mussel beds, gobies
and a herring school) and `effects.ts`, two labelled "made visible" layers tied to hotspots:

- **Hotspot 2** (`hs_corrosion`): the explosive fill dissolving out of the open casing, an amber trail carried
  down-current, with the mussels in its path glowing.
- **Hotspot 3** (`hs_survey`): a placeholder mapping AUV (built in code, no third-party asset) flying survey lanes
  over the mine, its multibeam sonar drawn as a fan and a scan map on the floor. Timed to cross the view when the
  camera lands. To be swapped for GEOMAR's model.

The labels are written in the page language (set from React with `SceneEngine.setLocale`).

The package files live in `public/local/scenes/<slug>/` and ship with the build; when they are there, the app
uses them for that scene instead of the CMS model, and falls back to the CMS model when they are not. The files and
settings for each package are listed in `src/engine/underwater/localPackages.ts`. The S1 files (`seabed_scene.glb`,
`chapter_mine.glb`, `vegetation.glb`, `vegetation_instances.json`, `detail_mine.glb`, `detail_casing.glb` and
`tex/T_Turf_*.webp`) are committed in `public/local/scenes/munitions/` for the demo, as an exception to the no-GLB
rule in `.gitignore`. To take a new delivery, copy those files over the old ones and compare against the viewer in
the delivery (`python -m http.server` in its folder) before shipping.

The local content still uses the placeholder anchors (`vp_1`, `hs_1` and so on), so the package maps them to the
model's names. Chapter 3 (the bubble curtain, hotspots 5 and 6) isn't built yet, so those stay hidden. Before
this goes to production, the CMS needs a way to hold a multi-file scene, and the CMS content should use the
model's own anchor names.

The built-in scenes (`src/engine/placeholderScene.ts`) use `vp_1` to `vp_4` for viewpoints and `hs_1` to `hs_6` for
hotspots. The first viewpoint is also the landing page's backdrop view.

## Model budget (reference phone)

GLB under 10 MB, under 100k triangles, textures up to 2K and compressed. Draco, meshopt and KTX2 are all supported.
Going over logs a console warning but still loads. Bought assets never go in this repo; `.gitignore` blocks the usual
3D formats.

## Strapi

The app uses the CMS's read-only public API (see `docs/public-api.md` in kiel-sealevel-cms), on its own origin:

| Request                                  | Used for                       |
| ---------------------------------------- | ------------------------------ |
| `GET /cms/api/public/scenes?locale=de`       | Scene list (`SceneSummaryDto`) |
| `GET /cms/api/public/scenes/:slug?locale=en` | One scene (`SceneDetailDto`)   |

It asks for both locales (`de`, `en`) and merges them by `id`, so anything missing in the requested language falls back
to the other one. A 404 means the scene doesn't exist in that language. Every response is checked against the shared
Zod schemas. In the scene list, a scene that doesn't match (for example a malformed slug) is left out with a console
error and the rest still show; any other response that doesn't match is treated like the CMS being down.

The schemas live in `src/api-contracts`, generated from `kiel-sealevel-cms/packages/api-contracts/src`. Don't edit that
directory. With both repos side by side in the same folder, refresh it with `npm run contracts:sync` and commit the
result, so the frontend still builds without the CMS repo.

Notes:

- **Image alt text** comes from the media file's `alternativeText` in the Media Library.
- **`body`** is a Blocks field. A plain text string also renders, but Markdown would show as raw text.
- **`model`** empty means the built-in fallback scene is used.
- **`credits`** shows at the bottom of the scene's points-of-interest menu (top right), when it isn't empty.
- **Scene order** on the landing page is the order the API returns, currently by slug.
- **`teaser`** is the short line under a scene's title, such as "Kolberger Heide · Kiel outer fjord".
- **`slug`** also picks the scene's look: slugs containing `seagrass` or `biodiversity` get the green theme, `reef` or
  `stone` the reef theme, and anything else the munitions theme.
- **`/uploads`** URLs are root-relative, so the reverse proxy (and the dev server) must forward `/uploads` to the CMS.
