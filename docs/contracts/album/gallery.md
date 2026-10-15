# Gallery interface

`App` owns one `CollectionController`, `NotesController` and shared
`ObjectUrls` cache. The entire welcome area opens folder selection through a
keyboard-accessible button. After selecting a folder, the separate Change folder
control remains available. Folder selection stays in the initiating gesture.
An input `change` with an empty `FileList` selects an empty snapshot; a `cancel`
event preserves the collection. If the browser sends no selection event for an
empty folder, the application cannot distinguish it from cancellation.
Unsupported files are skipped without a collection notice. The gallery consumes
the [collection and notes contracts](local-data.md) and
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
Its bounded grid contains portrait, square and landscape frames. Changes to
other entries retain the native elements and URLs of unchanged visible images.
A 96-megapixel soft estimate controls optional overscan using metadata dimensions;
unknown dimensions assume 24 megapixels. Visible images and carousel neighbors
remain required, so this is not a hard browser-memory cap. Native animation
buffers and browser caches are outside the application's resource accounting.
Active selection scrolls only the strip. Every entry remains reachable by the
strip controls, horizontal scrolling, thumbnail buttons and looping navigation.
Short collections are centered horizontally; overflowing collections start at
the first thumbnail and retain their full scroll range.

The native modal opens only when an already-central image is activated. It makes
the background inert, confines keyboard focus to its close control, closes on
Escape and restores focus to the opener without scrolling. An in-flight scan's
replacement updates the modal to the current revision; removing its entry closes
the modal, with a fallback focus target if the opener no longer exists. Gallery
shortcuts exclude editing, composition, selectors, modifier keys and open dialogs.

`Inspection` shows resolution, format, file size and C2PA provenance as untrusted
text. The C2PA section always shows the same five declaration fields in the same
order. Empty values distinguish a pending read, no detected C2PA, a field not
recorded in a completed read, and an unknown value after an incomplete or failed
read. Declaration tools and explicitly declared AI generators have distinct
labels. Filenames and values have reserved line space and scroll when longer,
returning to the beginning on photo changes. The note-status line also retains
its space when empty to keep selection changes from shifting the panel.
On desktop, the panel scrolls within the gallery workspace without increasing
its height or pushing the thumbnail strip down. On mobile, the panel remains
in the page flow below the thumbnails.
A single copy button beside the filename copies the filename, full metadata
values and C2PA status, declarations and caveat as labeled plain text in the
current UI language. Multiline values are indented, and metadata read notices are included.
Copy uses the clipboard API only in a button gesture and reports failure locally.
`NotesEditor` subscribes separately, masks stale selections, disables editing
until a draft is available and flushes on blur. The application also flushes on
visibility loss and pagehide; these final transactions remain best effort.

`apps/album/src/i18n.ts` provides the complete PL/EN/DE/ES dictionaries, typed
with the shared `MessagesOf`. `App` owns the language and theme state of the
[shared](../shared.md#shared-package) `Header`. Persisted preferences use the
shared preference functions with the prefix `ai-tools-album`, that is
`ai-tools-album-language` and `ai-tools-album-theme` in localStorage;
unavailable storage falls back to in-memory preferences. The default language
is Polish, without browser language detection, and the default theme is light.
Original metadata values and product names are never translated.

The provided logo is bundled unchanged from the shared package.
