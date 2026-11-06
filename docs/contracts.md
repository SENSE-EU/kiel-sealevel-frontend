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
hotspots.

## Model budget (reference phone)

GLB under 10 MB, under 100k triangles, textures up to 2K and compressed. Draco, meshopt and KTX2 are all supported.
Going over logs a console warning but still loads. Bought assets never go in this repo; `.gitignore` blocks the usual
3D formats.

## Strapi

The app calls `GET /api/scenes` on its own origin, with explicit `populate`, once per locale (`de`, `en`). It merges the
two by `documentId`, so anything missing in the requested language falls back to the other one. The public role only
needs `find` and `findOne` on these types.

| Type      | Fields (L = localised)                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene     | `title` L, `slug`, `teaser` L, `cardImage`, `model`, `startViewpoint` (relation), `viewpoints` (relation), `hotspots` (relation), `credits` L |
| Viewpoint | `name`, `anchor`, `order`, `label` L                                                                                                          |
| Hotspot   | `title` L, `body` L, `image`, `imageAlt` L, `video`, `anchor`, `order`                                                                        |

Assumptions to confirm with the backend:

- **`imageAlt`** is a separate localised text field. The scope asks for a localised alt, and a Strapi media file's own
  `alternativeText` isn't localised; it is only used if `imageAlt` is empty.
- **`body`** is a Blocks field. A plain text string also renders, but Markdown would show as raw text.
- **`model`** empty means the built-in fallback scene is used.
- **`teaser`** is the short line under a scene's title, such as "Kolberger Heide · Kiel outer fjord".
