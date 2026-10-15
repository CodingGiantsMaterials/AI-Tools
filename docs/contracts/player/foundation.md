# Foundation contracts

## Build

The [shared build contract](../shared.md#build) defines the toolchain, commands
and output layout. Player production output is `dist/Player` with base
`/AI-Tools/Player/`: `index.html`, `sw.js`, its Workbox runtime
`workbox-<hash>.js` and hashed assets for the application JavaScript and CSS,
the `workbox-window` chunk and the logo. Only this workspace depends on
`vite-plugin-pwa` (development) and `workbox-window` (runtime); `vite.shared.ts`
never adds the plugin, so Album has no service worker. The workspace
`tsconfig.json` includes the `vite-plugin-pwa/react` types for the virtual
registration module. There is no web app manifest, server routing or backend.
The entry module renders `App` inside `StrictMode`.

The development server uses the shared HTTPS certificate and registers no
service worker, because the registration module is inert in development. The
production preview (`npm run preview -w @ai-tools/player`) serves HTTP on
`127.0.0.1`, a secure context: Chrome rejects service worker registration with
the self-signed certificate. Check the service worker, offline use and updates
on the preview.

## Service worker

`apps/player/vite.config.ts` passes `VitePWA` to `appConfig('Player', …)` with
`strategies: 'generateSW'`, `registerType: 'prompt'`, `injectRegister: false`,
`manifest: false`, `filename: 'sw.js'` and
`workbox.globPatterns: ['**/*.{js,css,html,png}']`. The plugin's `base` and
`scope` default to the Vite base from `appConfig`, so the published path is set
only in `vite.shared.ts`. The generated worker
precaches `index.html`, the JavaScript, the CSS, the `workbox-window` chunk and
the logo. It answers navigations inside its scope with the cached `index.html`
and removes outdated precaches. It skips waiting only on the `SKIP_WAITING`
message and never claims clients. Its scope cannot extend beyond
`/AI-Tools/Player/` ([addresses](../shared.md#addresses)). Tracks and the cover
never enter Cache Storage: they stay in [IndexedDB](local-data.md#database) and
play from `blob:` URLs.

`App` registers the worker with `useRegisterSW` from
`virtual:pwa-register/react`, so the registration code is bundled and the CSP
needs no inline script. A failed registration, or a browser without service
workers, leaves the application working online without offline use and without
a message. Offline use requires that first installation to finish online.

## Updates

The browser checks `sw.js` when the application is opened or reloaded inside
its scope. A changed worker installs and waits. If a precache request fails,
the browser discards the new worker and the working version stays active. A
waiting worker sets `needRefresh`, and the header offers the translated update
notice with an Update button. Nothing reloads automatically, and playback
continues.

Update hides the offer, pauses playback and awaits
[`LibraryController.saveSession()`](local-data.md#library-controller), which
stores the current track, position, mute, repeat, shuffle and used tracks. It
then calls `updateServiceWorker(true)`, which sends `SKIP_WAITING`. When the new
worker takes control, the tab reloads and restores the library, the track and
its position, paused. A tab whose version was replaced by an update applied in
another tab is not reloaded: it keeps playing its loaded code and keeps the
offer, and its Update then saves the session and reloads directly.

Updates never touch IndexedDB. Schema changes follow the
[migration rules](local-data.md#database).

## Content security policy and network

Production keeps the policy of `apps/player/index.html`:

```text
default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self' blob:; media-src 'self' blob:; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'
```

Compared with Album, it adds `media-src 'self' blob:` for playback from
IndexedDB and omits `'wasm-unsafe-eval'`. The production HTML loads only
same-origin script and stylesheet files and contains no inline script, style
element, style attribute or event handler attribute. A feature that would need
another source changes the code, not the policy. The
[shared build contract](../shared.md#build) describes the development server's
`'unsafe-inline'` relaxation.

The application never sends library data: files, file names, the cover and
playback state stay in the browser. Its own requests are GET requests for its
static files. The browser additionally requests `sw.js` for update checks and
may request `/favicon.ico` at the origin root. There is no analytics, external
service or runtime CDN. Opening the application online still connects to the
static hosting, which records connection data, so privacy statements describe
library data and do not promise zero network traffic. File names are rendered
only as text.
