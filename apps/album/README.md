# Album

A static browser application for browsing local photos in capture-date order.
A looping carousel, thumbnail strip, enlarged preview and two-field comparison
display original images, including animated PNG and WebP. Pin either comparison
field to change the other. The active-image panel shows recorded metadata,
C2PA declarations and automatically saved local notes. The interface supports
Polish, English, German and Spanish, with light and dark themes.

The application is published at
`https://codinggiantsmaterials.github.io/AI-Tools/Album/`.

## Using the gallery

Click the welcome area to choose a local folder containing JPEG, PNG or WebP
images. Use Change folder to select another folder. Only its direct files
are read; subfolders are skipped. Where read-only directory access is available,
Refresh scans for changes, and navigation checks the selected file again.
Otherwise the browser imports a snapshot: choose the folder again to load changes.
Cancelling the picker preserves the current collection. Browsers that do not
report an empty folder selection cannot distinguish it from a cancelled picker.

Use the arrows, side images or thumbnails to navigate. Clicking the already
central image opens the full-frame preview; Escape closes it. Notes and form
controls keep their own keyboard behavior. Comparison shows which field is active;
its metadata and notes follow that field. A deleted pinned image stays unavailable
until it returns or is unpinned.

Photos are ordered by capture date: EXIF first, then XMP, with undated photos
last and deterministic filename ties. Dates with offsets are normalized to UTC;
offset-free components are an ordering convention, not a claimed time zone.

## Privacy and local data

Photos are read without modifying the originals. Images, metadata, hashes and
notes remain on the device. Only bundled static application assets are requested;
image-supplied URLs, remote manifests, trust lists and OCSP are not fetched.
There is no backend, account, analytics, external runtime CDN or service worker.
Opening the application initially requires access to its static hosting.

Notes save automatically in IndexedDB (`ai-tools-album`, schema 1) after
the original file's full-byte SHA-256 is ready. Identical copies, moves and renames
share a note. Any byte change, including metadata, gives a new identity. Wait for
the saved status before closing: pending exit-time writes are only best effort.
A failed save retains the draft in memory; edits in another tab can cause a
conflict instead of silently overwriting that tab's note.

Committed notes survive reopening in the same browser profile and origin.
Clearing site data, losing storage or changing profile has no recovery or backup.
The database name identifies this app; project paths do not isolate it from other
apps at the [same origin](../../README.md#shared-origin). Language and theme
preferences use the localStorage keys `ai-tools-album-language` and
`ai-tools-album-theme`.

C2PA presents recorded declarations and available editing steps, not a signature
trust verdict or an AI detector. Neither presence nor absence proves authenticity.
Oversized or malformed metadata is bounded and reported separately from image
display. Native browser rendering controls animation, orientation and ICC
conversion; reading a profile does not establish full color fidelity.

## Development and checks

Run commands from the repository root; the [repository README](../../README.md)
describes the Node.js version, workspace setup and GitHub Pages publication.

```powershell
npm ci
npm run dev -w @ai-tools/album
```

The development server uses HTTPS with a locally generated, self-signed
certificate. Production assets are built for `/AI-Tools/Album/` and need only
static HTTPS hosting.

```powershell
npm run build -w @ai-tools/album
```

`npm run preview -w @ai-tools/album` serves `dist/Album`.

The base `/AI-Tools/Album/` applies to the logo, JavaScript, CSS, workers and
WASM. The deployment needs no server routes, cross-origin isolation or custom
headers; the production HTML includes a CSP.

See the [foundation contracts](../../docs/contracts/album/foundation.md) and
[collection and notes contracts](../../docs/contracts/album/local-data.md) for
service interfaces, lifecycle rules and capability limits. The
[gallery contract](../../docs/contracts/album/gallery.md) describes the UI
integration. The [shared contract](../../docs/contracts/shared.md) covers the
build, addresses and shared origin.
