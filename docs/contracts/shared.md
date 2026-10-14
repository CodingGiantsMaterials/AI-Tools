# Shared contracts

## Build

The root `package.json` declares the npm workspaces `packages/*` and `apps/*`.
One root `package-lock.json` pins every dependency. Node.js 24 LTS, strict
TypeScript, React and Vite use exact versions: shared tooling is a root
development dependency, and each application declares its own runtime
dependencies. Install with `npm ci` at the root. `npm run typecheck` and
`npm run build` run the scripts of every workspace that defines them; an
application build type-checks before `vite build`.

`tsconfig.base.json` holds the common compiler options. Each workspace's
`tsconfig.json` extends it and sets its own `types` and `include`.

`vite.shared.ts` exports `appConfig(app, plugins)`, which each
`apps/<app>/vite.config.ts` imports by relative path. It sets base
`/AI-Tools/<App>/` and output directory `dist/<App>/` at the repository root,
emptied on every build. It adds React, the local HTTPS certificate, the
development CSP relaxation, the application's extra plugins and ES module
workers. It resolves `react` and `react-dom` from the application, so linked
workspace packages never bundle a second React copy. Development and preview
servers use a generated self-signed certificate. For Vite's inline refresh
scripts and styles, the development server alone adds `'unsafe-inline'` to the
`script-src` and `style-src` directives of the CSP `meta` tag, whatever their
other sources; production retains each application's CSP in its `index.html`.

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

## Shared package

The workspace `@ai-tools/shared` in `packages/shared` holds source modules used
by more than one application. It has no build step: its `exports` point at
TypeScript, CSS and asset sources, which each application's Vite build
compiles, and its own `typecheck` script checks them. React is a peer
dependency, so applications keep one React copy. Dictionaries, application
state and data identifiers stay in the applications.

- `@ai-tools/shared/i18n` exports `languages` (`pl`, `en`, `de`, `es`),
  `Language` and `isLanguage(value)`. `MessagesOf<typeof reference>` is the
  message shape of an application's reference dictionary; annotating each other
  language's dictionary with it makes a missing or unknown key a compile error.
  A message is text or a function inserting parameters, such as
  `` (n: number) => `Track ${n}` ``. `browserLanguage(preferences?)` returns the
  first supported primary subtag of `navigator.languages` (`es-MX` gives `es`),
  otherwise `en`.
- `@ai-tools/shared/preferences` exports `storedPreference(prefix, key)` and
  `savePreference(prefix, key, value)` for the localStorage key
  `<prefix>-<key>`. Without storage, reads return null and writes are ignored,
  so the application's state keeps the value in memory.
- `@ai-tools/shared/header` exports `Header`: the logo with a visually hidden
  `<h1>` title on the left, optional application controls as `children`, and
  the language select and light/dark switch on the right. Labels come from the
  application's dictionary, the application owns the language and theme state,
  and its `className` lays out the `<header>`.
  `useDocumentPreferences(language, theme)` sets `<html lang>` and
  `<html data-theme>`; `Theme` is `light` or `dark`.
- `@ai-tools/shared/theme.css` defines the color tokens on `:root` (light, the
  default) and `:root[data-theme="dark"]`, and the base element, button and
  focus rules. Each application imports it once in its entry module.
- `@ai-tools/shared/icon` exports `Icon` and `IconName`: decorative 20 px
  stroke icons, including playback, repeat, shuffle, volume and plus icons.
  Controls supply accessible names.
- `@ai-tools/shared/logo.png` is the provided Coding Giants logo, unchanged.
- `@ai-tools/shared/object-urls` exports `ObjectUrls`.
  `acquire(revisionKey, blob)` returns a reference-counted `blob:` URL lease
  shared by equal keys; the last `release()` revokes the URL, and `dispose()`
  revokes every URL and rejects later acquisitions. Acquire outside React render
  and never reuse a key for different bytes.
- `@ai-tools/shared/image-format` exports `imageFormat(blob)`, which recognizes
  JPEG, PNG and WebP signatures independently of names and MIME types. It
  identifies candidates, not successful decodes.
- `@ai-tools/shared/indexed-db` exports `openDatabase(name, version, options)`.
  `options.upgrade(database, oldVersion, transaction)` runs in the
  version-change transaction for ordered migrations; a thrown error aborts the
  upgrade. Opening rejects with `DatabaseUnavailable` on failure, when blocked
  by another connection or after `options.timeout` (8 s by default), and closes
  a connection that succeeds afterwards. The resolved connection closes on
  `versionchange` and then calls `options.onVersionChange`, so it never blocks
  an upgrade in another tab.
