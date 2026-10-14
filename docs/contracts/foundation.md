# Foundation contracts

## Build and validation

Node.js 24 LTS, strict TypeScript, React and Vite are pinned in `package.json`
and `package-lock.json`. Install dependencies with `npm ci` and validate with
`npm run build`.

Production output is `dist` with base `/AI-Tools/`. Workers and WASM are local
hashed assets.
No COOP/COEP headers, SharedArrayBuffer, service worker, server routing or backend
are required. Local dev/preview use a generated self-signed certificate.
Development alone permits inline scripts/styles for Vite refresh; production
retains the CSP in `index.html`.

## Folder access

`src/files/folder-source.ts` exports `FolderSource`, `FolderEntry`,
`pickDirectory`, `directorySource`, `snapshotSource` and feature detection.
Picker calls use `mode: 'read'` and must occur directly in a user gesture.
Scanning only queries permission and never requests or escalates it.

Both sources list direct children only. The directory adapter lists handles
without recursive traversal, reacquiring a `File` on each `getFile()` call.
Permission or removal failures reject. Snapshot entries retain the imported
`File` and have `canRefresh: false`: reload requires another user selection.
The UI must show the translated reselect notice in this mode.

Entry IDs are source-local keys, not content identities. The
[collection controller](local-data.md#collection) owns monotonically increasing
folder generations. Filename, size and modification time cannot prove identical
content. Source adapters do not own
scan coalescing, collection sorting or active-entry state.

## Identity and background results

`WorkKey` contains folder generation, entry ID, content revision and request ID.
Every service result echoes that key. Consumers must compare all fields with
`sameWork` before updating the relevant current state; returning a key does not
itself apply the stale-result check. Retain the original key for notes writes.

`IdentityService.hash(file, key, priority?, signal?)` returns a lower-case
64-character SHA-256 of every original byte, independent of name and location.
Identical copies share content identity; changed metadata changes identity.
The digest is calculated in a worker. One hash is active at a time; 16 pending
tasks are allowed and larger priority values run first. Overflow rejects with
`QueueFull`. Cancellation drops queued jobs or terminates active hash workers.
Hashing has a 30-second timeout and currently buffers one entire file; callers
must not infer a browser memory limit from this queue. Call `dispose()` on
service teardown. The [notes repository and controller](local-data.md#notes)
provide production persistence and autosave using this identity.

## Original image resources

`imageFormat` checks JPEG, PNG and WebP signatures independently of names or MIME
labels. It identifies candidates, not successful decodes. Use native image error
events for damaged images.

`OriginalUrls.acquire(revisionKey, original)` creates a reference-counted lease
over the unchanged `File`. The same revision key shares its URL across consumers.
Keys must include folder, entry and content revision; never reuse a key for
changed bytes. Release a lease when its consumer unmounts or changes revision;
`dispose()` revokes remaining resources and closes the cache. Acquire outside
React render. The foundation never resamples, recompresses or extracts frames.
Native `<img>` preserves APNG/WebP animation and browser orientation; use
`object-fit: contain` for full-frame views. A small CSS image can still decode
at full resolution: later collection consumers must limit mounted resources.
The preview uses the collection controller's resource key to retain its mounted
image and URL during unchanged refreshes. The controller compares original-byte
hashes for the same entry and retains the revision when they match; changed bytes
receive a new revision and lease. Hashing does not delay initial display.
A failed hash cannot establish equal content.
Native decode failure belongs to the preview URL independently of folder and
C2PA status. Its message persists while an unchanged preview is retained and
does not carry over to a replacement URL.

## C2PA boundary

`ProvenanceService.read(file, key, priority?, signal?)` returns normalized data
without exposing SDK objects to UI consumers. A directly owned worker uses
`@contentauth/c2pa-wasm` 0.13.2 and passes the serialized `localReadContext` to
`WasmReader.fromBlob`. The Context comes from c2pa-utilities 0.3.1. Its `verify`
settings
disable `verifyAfterReading`, `verifyTrust`, `verifyTimestampTrust`,
`remoteManifestFetch` and `ocspFetch`. Trust/CAWG anchor inputs are empty and
trust-list handling is disabled. Never replace this with the SDK defaults or
pass metadata-sourced URLs to trust settings or resource helpers.

Status codes are `detected`, `none`, `remote`, `unsupported` and `error`.
`detection` independently records `present`, `absent`, `external` or `unknown`;
`completeness` records `complete`, `partial` or `not-read`. `none` is reserved for
the native SDK's exact `C2pa(JumbfNotFound)` result. Remote manifest references
remain explicit and are not fetched. Missing/unknown algorithms are unsupported;
malformed data is an error.
The SDK can return a reader without a readable active manifest: retain present
detection with partial completeness and an error status.

Normalization exposes claim-generator text and recorded action labels, capped at
2,048 characters and 64 actions (128 assertions inspected), plus bounded
[provenance declarations](local-data.md#provenance).
`complete` means this normalized active-manifest read finished within its limits;
it does not mean a complete editing history or verified signature. A claim
generator is not automatically an AI generator. No manifest icons or thumbnails
are resolved. The Polish detected status is exactly `Wykryto C2PA`.

One C2PA read is active at a time, with the same bounded priority queue as
identity. Input above 64 MiB returns `unsupported`; the whole active read times
out after 20 s, including signature detection and WASM initialization.
Cancellation and disposal reject with `AbortError`, also during those phases.
These limits affect provenance, never native image display. Readers are freed
on completion and the owned worker is terminated on every completion,
cancellation, timeout or failure; consumers dispose the service on teardown.

The [local data contracts](local-data.md) define collection management, ordinary
metadata and note editing services separately from their UI presentation.
