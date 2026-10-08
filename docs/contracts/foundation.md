# Foundation contracts

## Build and validation

Node.js 24 LTS, strict TypeScript, React and Vite are pinned in `package.json`
and `package-lock.json`. `npm ci`, `npm test`, `npm run build` and
`npm run test:browser` are the validation commands. Install browser binaries
with `npx playwright install chromium firefox webkit` first.

Production output is `dist` with base `/Web-Album/`. Workers and WASM are local
hashed assets; HTTPS is required by the C2PA SDK's external-worker loader.
No COOP/COEP headers, SharedArrayBuffer, service worker, server routing or backend
are required. Local dev/preview use a generated self-signed certificate.
Development alone permits inline scripts/styles for Vite refresh; production
retains the CSP in `index.html`.

Browser tests serve the production `dist` on port 4174 and a production-optimized
build with a test-only entry point under `.discovery-build` on port 4173.
That entry is excluded from `dist`. The privacy probe
disables CSP, observes requests from the page and workers, and verifies the
observer with a separate worker request. Local `blob:` reads are not network
egress. The default page tests retain CSP. WebKit automation is not a test of
the Safari application or native OS permission dialogs.

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

Entry IDs are source-local keys, not content identities. Add a monotonically
increasing folder generation at the collection boundary. Filename, size and
modification time cannot prove identical content. Source adapters do not own
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
service teardown. The IndexedDB browser probe validates content-key persistence;
the production notes repository and autosave controller are separate work.

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

## C2PA boundary

`ProvenanceService.read(file, key, priority?, signal?)` returns normalized data
without exposing SDK objects to UI consumers. Each read passes the explicit
`localReadContext` to `Reader.fromBlob`. In c2pa-web 0.15.3 its `verify` settings
disable `verifyAfterReading`, `verifyTrust`, `verifyTimestampTrust`,
`remoteManifestFetch` and `ocspFetch`. Trust/CAWG anchor inputs are empty and
trust-list handling is disabled. Never replace this with the SDK defaults or
pass metadata-sourced URLs to trust settings or resource helpers.

Status codes are `detected`, `none`, `remote`, `unsupported` and `error`.
`detection` independently records `present`, `absent`, `external` or `unknown`;
`completeness` records `complete`, `partial` or `not-read`. `none` is reserved for
the SDK's null result. Remote manifest references remain explicit and are not
fetched. Missing/unknown algorithms are unsupported; malformed data is an error.
The SDK can return a reader without a readable active manifest: retain present
detection with partial completeness and an error status.

The minimal normalization exposes only claim-generator text and recorded action
labels, capped at 2,048 characters and 64 actions (128 assertions inspected).
`complete` means this normalized active-manifest read finished within its limits;
it does not mean a complete editing history or verified signature. A claim
generator is not automatically an AI generator. No manifest icons or thumbnails
are resolved. The Polish detected status is exactly `Wykryto C2PA`.

One C2PA read is active at a time, with the same bounded priority queue as
identity. Input above 64 MiB returns `unsupported`; reads time out after 20 s.
These limits affect provenance, never native image display. Readers are freed
and their SDK workers disposed after each operation; consumers dispose the
service on teardown. Repeat the privacy tests whenever SDK versions, settings
or resource handling change. Production metadata presentation, complete
normalization, collection management and note editing are not provided here.
