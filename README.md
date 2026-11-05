# PWA Sensors

An installable React + Vite playground with a shake detector and microphone blow
detector. Tailwind CSS v4 provides styling; TanStack Router handles navigation.

## Local development

Use the Node version in `.nvmrc` (with nvm: `nvm use`), then:

```bash
yarn install
yarn dev
```

The service worker is disabled during development. To test installation and offline
support, build and preview the production app:

```bash
yarn build
yarn preview
```

To test on your phone over HTTPS, run `ngrok http 4173 --host-header=localhost:4173`
while the preview server runs on port 4173. Microphone and motion access require
HTTPS or localhost, supported hardware, and browser permission. Safari on iOS
requires Share → Add to Home Screen for installation.

## GitHub Pages

Live site: https://snada.github.io/pwa-sensors/

Pushes to `master` run `.github/workflows/pages.yml`, which installs dependencies,
checks types, lints, tests the detectors, builds, and deploys to GitHub Pages.
The repository's Pages publishing source must be **GitHub Actions**.

Pages builds use `/pwa-sensors/` as the Vite base and hash-based routes, so direct
links and refreshes work without a server rewrite. For example:
`https://snada.github.io/pwa-sensors/#/page-1`.
Local development and ordinary builds keep the root base and browser routes.

To preview the Pages build locally:

```bash
GITHUB_PAGES=true yarn build
yarn preview
```

Then open `http://localhost:4173/pwa-sensors/`.

## PWA behavior

Before installation, the home page offers installation. After installation, the
browser tab directs you to open the app from your home screen or app list. The
standalone app shows connection status and links to both detectors.

Production builds precache the app and route bundles for offline use after an
initial online visit. Updates wait for **Reload to update** on the installed app's
home page. Reinstall the app from the Pages URL if you previously installed it
from ngrok: these are separate origins with separate permissions.

Each detector logs completed events with duration in seconds. Motion listeners
and microphone resources are released when leaving their page. Microphone audio
is analyzed locally, without recording or uploading it. Blow detection is a
heuristic; background noise and different microphones can affect its accuracy.

## Checks

```bash
yarn lint
yarn tsc --noEmit
node --experimental-strip-types --test tests/*.test.ts
```
