# Shared contracts

## Build

The root `package.json` declares the npm workspaces `packages/*` and `apps/*`.
One root `package-lock.json` pins every dependency. Node.js 24 LTS, strict
TypeScript, React and Vite use exact versions: shared tooling is a root
development dependency, and each application declares its own runtime
dependencies. Install with `npm ci` at the root. `npm run typecheck` and
`npm run build` run the scripts of every workspace that defines them; an
application build type-checks before `vite build`.

`tsconfig.base.json` holds the common compiler options. Each application's
`tsconfig.json` extends it and sets its own `types` and `include`.

`vite.shared.ts` exports `appConfig(app, plugins)`, which each
`apps/<app>/vite.config.ts` imports by relative path. It sets base
`/AI-Tools/<App>/` and output directory `dist/<App>/` at the repository root,
emptied on every build. It adds React, the local HTTPS certificate, the
development CSP relaxation, the application's extra plugins and ES module
workers. Development and preview servers use a generated self-signed
certificate. Development alone permits inline scripts and styles for Vite
refresh; production retains each application's CSP in its `index.html`.

## Addresses

Each application is published at
`https://codinggiantsmaterials.github.io/AI-Tools/<App>/` from `dist/<App>/`.
GitHub Pages paths are case-sensitive: the output directory name comes only from
the name passed to `appConfig` and must match the published path exactly, while
source directories stay lowercase (`apps/<app>`). Changing the repository path
requires updating the base in `vite.shared.ts` before building. Each application
has one screen and needs no router, SPA `404.html` or server rules.

The Pages artifact is the whole `dist` directory, so every deployment publishes
all applications together. Each application runs its own development server,
for example `https://localhost:5173/AI-Tools/Album/`.

## Shared origin

All applications share the origin `https://codinggiantsmaterials.github.io`
with the organization's other Pages projects. IndexedDB, localStorage, Cache
Storage, the storage quota and `navigator.storage.persist()` grants are per
origin, and clearing site data removes the data of every application.

Each application prefixes its IndexedDB database names and localStorage keys
with `ai-tools-<app>`. Album uses the database `ai-tools-album` and the keys
`ai-tools-album-language` and `ai-tools-album-theme`. Distinct names prevent
collisions but are not a security boundary: do not host untrusted applications
at this origin.
