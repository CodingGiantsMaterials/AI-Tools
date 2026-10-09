# Gallery interface

`App` owns one `CollectionController`, `NotesController` and shared
`OriginalUrls` cache. Folder selection stays in the initiating gesture.
An input `change` with an empty `FileList` selects an empty snapshot; a `cancel`
event preserves the collection. If the browser sends no selection event for an
empty folder, the application cannot distinguish it from cancellation.
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
Its bounded grid contains portrait, square and landscape frames. Changes to
other entries retain the native elements and URLs of unchanged visible images.
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

## Comparison

`comparison-state.ts` owns two entry-ID/name assignments, the active field,
one optional pinned field and a folder generation. Assignments retain no original
files or decoded buffers. `Comparison` renders both original revisions at full
opacity with containment and at most two prepared navigation neighbors. The same
`OriginalImage`, URL cache, thumbnail strip, keyboard guard and inspection panel
serve carousel and comparison.

Selecting a field changes inspection and its note immediately. Pinning a field
selects the other field; pinning the other field transfers the single pin.
Navigation and thumbnail assignment target the active field unless it is pinned,
in which case they target the other field and activate it. Navigation skips the
other field's entry and loops through the remaining choices. Selecting a thumbnail
already assigned to the opposite field inspects that field without duplicating it.
The navigation caption identifies the editable field, including when inspecting
the pinned field. Notes always follow the inspected field's current content ID.

Empty fields explicitly request another image. Two entries occupy distinct fields;
navigation is disabled when there is no alternative for the editable field.
Missing unpinned assignments reconcile to available distinct entries. A missing
pinned assignment retains only its entry ID/name, displays unavailable, and has
no image, metadata or editable note. It recovers only if that entry returns;
unpinning releases the missing assignment. Comparison remains visible even when
the collection becomes empty. Folder changes reset both assignments and pinning.

Leaving comparison selects its available active entry in the carousel. Entering
comparison assigns or inspects the carousel entry under the same pin rules.
Metadata and original revisions always come from the current collection; equal-byte
refreshes retain mounted images, while replacements change their resource keys.
No additional image editing, overlay, zoom or animation synchronization is applied.
