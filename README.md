# SEALEVEL Kiel: frontend

The visitor-facing app for the SENSE (WP6) underwater scenes: a 2D landing page, and 3D scenes where visitors move
between fixed viewpoints and open hotspots. All content comes from Strapi, so editors can change it without a deploy.

React, TypeScript, Vite, Tailwind CSS, plain Three.js, i18next and React Router.

## Run it locally

Needs Node 24.

```sh
npm install
npm run dev
```

This reads content from a local [kiel-sealevel-cms](https://github.com/SENSE-EU/kiel-sealevel-cms) on
<http://localhost:1337> (start it first, see that repo's README), through the dev server's proxy for `/cms` and `/uploads`.
Open <http://localhost:5173>. To use a CMS somewhere else, set `STRAPI_PROXY_TARGET` in `.env.local`.

To work without a backend, run `npm run dev:mock` instead: built-in placeholder content and a procedural placeholder
scene. A console warning about `hs_does_not_exist` is expected there: the mock data includes a broken anchor to show that
it gets hidden.

| Command                                    | What it does                     |
| ------------------------------------------ | -------------------------------- |
| `npm run dev:mock`                         | Run on placeholder content       |
| `npm run build`                            | Type-check and build             |
| `npm run lint` / `typecheck` / `test`      | Checks, also run by CI           |
| `npm run format`                           | Format with Prettier             |
| `npm run contracts:sync`                   | Copy the CMS's API schemas in    |
| `docker build -t kiel-sealevel-frontend .` | Production image, serves on 8080 |

## How it fits together

```
src/
  api-contracts/  Zod schemas of the CMS public API. Generated from kiel-sealevel-cms; don't edit
  app/         Router
  routes/      Pages: landing, scene, errors. The locale comes from the URL (/de, /en/scenes/munitions)
  components/  UI, with the scene overlay (pins, panel, list, viewpoints) in components/scene
  content/     CMS access behind the ContentSource interface: public API client, mock, locale fallback
  engine/      Everything Three.js. Knows anchors, not the CMS or React (except the useSceneEngine hook)
  i18n/        UI strings. Editorial text is localised in Strapi instead
  state/       Visited hotspots, kept in localStorage
```

- Three.js is its own chunk. The landing page is readable and usable before it arrives, and its 3D backdrop always uses the
  built-in scenes, so no GLB downloads until a visitor picks a scene.
- Each scene's look (colours, water, light) comes from `src/engine/themes.ts`, chosen by slug.
- The font (Plus Jakarta Sans) is self-hosted, so visitors make no requests to Google.
- Hotspot pins are real DOM buttons positioned over the canvas, so they work with touch, keyboard and screen readers.
- If the CMS is down the reverse proxy serves its cached copy. With nothing cached, the app shows a message and a retry.
- Without WebGL, the hotspot list and panels still work.

[docs/contracts.md](docs/contracts.md) covers the anchor naming the 3D team must follow and how the app reads content from Strapi.

## Deployment

`.github/workflows/ci.yml` checks every PR, and on `main` pushes an image to the container registry. It needs the
repository secrets `ACR_USERNAME` and `ACR_PASSWORD`. The image serves only the static build; `/cms`, `/uploads`, HTTPS
and caching belong to the reverse proxy in front of it. No secrets or bought 3D assets belong in this repo.
