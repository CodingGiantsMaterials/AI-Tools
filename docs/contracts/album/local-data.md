# Collection, metadata and notes

## Collection

`CollectionController` owns `setSource(source)`, `refresh()`, `activate(entryId)`,
`getSnapshot()`, `subscribe(listener)` and asynchronous `dispose()`. React can use
`useSyncExternalStore` with the bound snapshot/subscription methods. Construct
one controller for the gallery, and await disposal in controlled teardown.

State carries codes, never translated messages: `no-folder`, `loading`, `ready`,
`empty`, `no-supported`, `access-denied` or `error`; `scanning` is independent.
`issues` identifies individual unavailable, unsupported or access-denied entries.
A failed whole-folder scan retains the previous collection with an error status.
`notice: 'reselect'` requires the translated snapshot-folder notice. Snapshot
`refresh()` is a no-op; the UI must offer another user-initiated selection.
Pickers and permission prompts remain in the user gesture, outside the controller.

Only one scan runs, with at most one coalesced repeat. A folder switch clears the
old state and cancels its work; an unabortable source list/read must finish before
the next scan. Manual refresh hashes all existing candidates. Activation checks
the current list and re-reads/hashes the selected file; unchanged other entries
use size and modification time as a cheap signal. Results reconcile atomically.
Active selection survives by `entryId`; if removed, the first remaining entry
becomes active. Consumers retaining pinned IDs must show their absence, never
silently substitute this fallback into a pinned comparison field.

Every entry exposes the original `file`, signature-derived `format`, `metadata`,
`key: WorkKey`, `resourceKey`, nullable `contentId`, `identityStatus`, and nullable
`provenance`. Signature recognition is independent of successful native decoding.
Metadata failure retains the entry; decode failure belongs to the image consumer.
Initial ordering waits for bounded ordinary-metadata reads, not identity or C2PA.
Hashes run one at a time, prioritizing the active entry. C2PA is read on demand
for the active entry. An identity failure leaves notes unavailable, not keyed by
filename. Service callbacks check generation, entry, revision, request and abort.

`resourceKey` changes only when the original revision changes or equality cannot
be established. Equal hashes preserve the previous original `File` and resource
key across scans. Use this key for React identity and `OriginalUrls` leases.
Acquire leases outside render, keep mounted originals through unchanged refresh,
and release on revision change/unmount. The controller creates no URLs and decodes
no full-resolution image. The UI must bound mounted images and prepare neighbors;
all image views use native original `<img>` sources, including animations.

## Ordinary metadata and ordering

`MetadataService.read(file, key, priority?, signal?)` echoes `WorkKey` and returns
`Metadata`. Its worker uses ExifReader 4.47.0 with expanded groups, asynchronous
PNG decompression, and a bundled xmldom 0.9.12 XML parser. No URL input or external
XML entities are accepted. Status is `ready`, `error`, or `unsupported`, with a
machine-readable reason. Only allowlisted fields cross the worker boundary.

Limits: one active read, 16 pending, a 10-second worker lifetime, 64 MiB input,
2 MiB per metadata/decompressed block, 8 MiB per encoded or decompressed metadata
budget and 128 encoded metadata blocks. Limit failures report `unsupported`;
corruption and timeout report `error`. These limits do not limit native display.
TIFF directories and chunk boundaries are checked before parsing. Decompression
and XML failures remain errors even where ExifReader would suppress exceptions.

The normalized shape includes signature format, filename, byte size, encoded
width/height, megapixels, informational EXIF orientation, ICC profile/color space,
recorded software, explicit generator fields, AI declarations, and recorded XMP
history. Values are plain untrusted text, capped at 2,048 characters and 32 items.
Never insert them as HTML or automatically load their URLs. An ICC label alone
does not establish color fidelity; the browser applies image orientation once.

`metadata.date` prefers valid EXIF `DateTimeOriginal` with
`SubSecTimeOriginal`/`OffsetTimeOriginal`, then XMP `DateTimeOriginal`/`DateCreated`.
Modification time is never a substitute. Offsets normalize whole seconds to UTC;
fractions retain up to 32 digits for exact ordering. Offset-free components use
nominal UTC, independent of the viewer's time zone, without claiming a real zone.
Invalid dates fall through to the next capture source or null. `compareEntries`
sorts valid dates first, missing dates last, then code-unit filename and entry ID.
Neither locale nor language changes this order.

## Provenance

The [C2PA boundary](foundation.md#c2pa-boundary) retains its privacy settings,
worker limits, and distinct detection/completeness/status fields. Normalization
also exposes capped ingredient titles, recorded digital-source declarations and
generator names only when a creation action explicitly declares trained
algorithmic media. `claimGenerator` is a provenance tool, separate from ordinary `software`
and explicit AI `generators`. No assertion is a verdict about image authenticity.
No manifest icons, thumbnails or linked resources are resolved.

## Notes

`NotesRepository` owns IndexedDB `ai-tools-album`, schema version 1,
store `notes` keyed by full-byte SHA-256 `contentId`. Records contain `text`,
`updatedAt` and positive integer `revision`. `get()` returns a note or null;
`save(note, expectedRevision)` compares the stored revision inside its write
transaction with the revision originally loaded or last successfully committed
by that draft (zero means no record). The new note revision must exceed that
base. A mismatch rejects the write, regardless of the number of local edits.
Saving resolves only on transaction completion. `close()` closes the connection.
The database name identifies the application, not an isolation boundary from
other [same-origin applications](../shared.md#shared-origin).

`NotesController` exposes `select(contentId | null)`, `edit(text)`, `flush()`,
`flushAll()`, `getSnapshot()`, `subscribe()` and asynchronous `dispose()`.
Select null while identity is unavailable. Selection immediately clears the
visible previous note, and flushes the previous content's pending draft.
Typing updates a per-content draft immediately; a 300 ms debounce automatically
starts the write. Each write captures the content ID, text, local revision and
last committed revision. Edits during a transaction receive their own later
write. Identical copies/renames share notes; changed bytes never inherit a
previous content's note.

State codes: `identity-pending`, `loading`, `ready`, `dirty`, `saving`, `saved`,
`error`; errors distinguish `read` from `write`. Disable editing without a loaded
draft. Failed writes retain drafts across selections and can retry via `flush`.
`saved` applies only after the matching revision commits. A failed read must not
be shown as an empty saved note. Subscribe to notes separately from the gallery
to keep per-keystroke updates local to the editor.

UI consumers should call `flushAll()` on page visibility loss/pagehide and await
`dispose()` on controlled teardown. Page exit transactions are best effort;
never promise that an unfinished write is durable. Successfully committed notes
survive reopening in the same browser profile/origin. Site data deletion, profile
changes or storage loss have no recovery mechanism or backup here. Multiple-tab
revision conflicts retain the local draft and report an error, without merging.

The [gallery contract](gallery.md) describes original-image rendering, modal
and notes integration.
