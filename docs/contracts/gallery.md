# Gallery interface

`App` owns one `CollectionController`, `NotesController` and shared
`OriginalUrls` cache. Folder selection stays in the initiating gesture.
The gallery consumes the [collection and notes contracts](local-data.md) and
does not reorder entries or use content identity as gallery identity.

`Gallery` receives `entries`, `activeId`, `activate(entryId)`, `urls` and a typed
translation dictionary `m`. It presents five visible looping positions and up
to two prepared neighbors, with unique entries for short collections. Stable
`resourceKey` keys retain native originals through movements and equal-byte
refreshes. CSS transform/opacity transitions retarget immediately. There is no
blur, image transformation, frame extraction or reduced-motion override.

`OriginalImage` acquires a URL lease in an effect and releases it on revision
change or unmount. It renders the original native image with containment,
browser orientation and a checkerboard background. Decode failures remain local
to the mounted original. All image views use this component.

`ThumbnailStrip` keeps a reserved button for every entry but mounts original
images only within the horizontal viewport and optional one-thumbnail overscan.
A 96-megapixel soft estimate controls optional overscan using metadata dimensions;
unknown dimensions assume 24 megapixels. Visible images and carousel neighbors
remain required, so this is not a hard browser-memory cap. Native animation
buffers and browser caches are outside the application's resource accounting.
Active selection scrolls only the strip. Every entry remains reachable by the
strip controls, horizontal scrolling, thumbnail buttons and looping navigation.

The native modal opens only when an already-central image is activated. It makes
the background inert, confines keyboard focus to its close control, closes on
Escape and restores focus to the opener without scrolling. An in-flight scan's
replacement updates the modal to the current revision; removing its entry closes
the modal, with a fallback focus target if the opener no longer exists. Gallery
shortcuts exclude editing, composition, selectors, modifier keys and open dialogs.

`Inspection` shows normalized metadata/provenance as untrusted text. C2PA status,
detection and completeness are separate; declaration tools, recorded software
and explicitly declared AI generators have distinct labels. Copy uses the
clipboard API only in a button gesture and reports failure locally.
`NotesEditor` subscribes separately, masks stale selections, disables editing
until a draft is available and flushes on blur. The application also flushes on
visibility loss and pagehide; these final transactions remain best effort.

`i18n.ts` provides the complete typed PL/EN/DE/ES dictionaries. Persisted
preferences use `web-album-language` and `web-album-theme` in localStorage;
unavailable storage falls back to in-memory preferences. The default theme is
light. Original metadata values and product names are never translated.

The provided logo is bundled unchanged at `src/assets/coding-giants-small-logo.png`.
Comparison is a disabled mode placeholder; field assignment and pinning are
not implemented by this gallery contract.

Validate with `npm test`, `npm run build` and `npm run test:browser`.
The gallery browser suite exercises real production renders, native animation
in each view, modal focus, four languages, notes, copy, folder states, 100-entry
resource lifetimes and desktop/mobile screenshots. Synthetic directory handles
test integration but do not establish native OS permission-dialog behavior.
