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
| `GET /api/public/scenes?locale=de`       | Scene list (`SceneSummaryDto`) |
| `GET /api/public/scenes/:slug?locale=en` | One scene (`SceneDetailDto`)   |

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
- **`teaser`** is the short line under a scene's title, such as "Kolberger Heide · Kiel outer fjord".
- **`slug`** also picks the scene's look: slugs containing `seagrass` or `biodiversity` get the green theme, `reef` or
  `stone` the reef theme, and anything else the munitions theme.
- **`/uploads`** URLs are root-relative, so the reverse proxy (and the dev server) must forward `/uploads` to the CMS.
