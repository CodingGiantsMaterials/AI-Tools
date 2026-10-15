# Library and local data

## Database

`LibraryRepository` in `apps/player/src/library/library-repository.ts` owns the
IndexedDB database `ai-tools-player`, schema version 1. It opens a lazy
connection with the [shared](../shared.md#shared-package) `openDatabase`.

| Store | Key path | Record |
| --- | --- | --- |
| `tracks` | `id` | `{ id, name, size, type: 'audio/mpeg', lastModified }` |
| `audioBlobs` | `trackId` | `{ trackId, blob }`, where `blob` is the selected `File` |
| `slots` | `index` | `{ index, trackId }` for each occupied row; empty rows have no record |
| `cover` | `id` | `{ id: 'cover', imageId, format, blob }` |
| `session` | `id` | `{ id: 'session', currentTrackId, position, muted, repeat, shuffle, used }` |

Track identifiers come from `crypto.randomUUID()`, never from file names.
Language and theme are [preferences](interface.md#languages-and-preferences),
not database records. Migrations run in `onupgradeneeded` in order of
`oldVersion`: a new schema version adds a step that keeps stored data, and no
upgrade deletes the database. A connection closes on `versionchange`, so an open
older tab never blocks an upgrade; that tab cannot open the newer schema until
it reloads. The database name identifies the application; it is not an
isolation boundary from other
[same-origin applications](../shared.md#shared-origin).

## Transactions

Each operation validates and prepares its input before it starts one
transaction. The transaction issues only IndexedDB requests, and the operation
succeeds only on the transaction's `complete` event. Failures reject with
`LibraryError`, whose code is `unavailable`, `read`, `write`, `quota` (from
`QuotaExceededError`), `conflict` or `missing`.

- `load()` reads `tracks`, `slots`, `cover` and `session` in one read-only
  transaction and never reads `audioBlobs`. It shape-checks every record, drops
  invalid records and slots whose track is missing, and keeps only the first row
  of a track placed twice. It validates each session field separately, uses
  defaults for invalid ones, and keeps the current and used tracks only when
  they are placed.
- `addTrack(track, file, index)` writes the track, its file and its slot in one
  `tracks`, `audioBlobs` and `slots` transaction. A row that belongs to an
  existing track aborts with `conflict`; a slot whose track is missing is
  reused.
- `deleteTrack(trackId, index)` removes the track, its file and, while it still
  references the track, its slot in one transaction.
- `replaceCover(cover)` and `saveSession(session)` each put one record.
- `readAudio(trackId)` returns the stored file or rejects with `missing`.

Tabs are not synchronized. Each tab shows the state it loaded, the session
record has no conflict detection, and the last write wins. Because every
library change is one transaction, no tab can leave a partial track or cover.

## Library controller

`LibraryController(repository, audio, random = Math.random)` in
`apps/player/src/library/library-controller.ts` owns `LibraryState`: `phase`
(`loading`, `ready` or `unavailable`), `slots`, `tracks`, per-row `pending`
(`adding` or `deleting`), `cover`, `coverPending`, `repeat`, `shuffle`, `used`
and `notice`. React reads it with `getSnapshot()` and `subscribe()`. `connect()`
follows the [audio events](playback.md#audio-controller) and starts loading
once, also under Strict Mode. No command runs and nothing is saved until
`phase` is `ready`. Unavailable storage sets `unavailable` and shows a notice.

`add(row, file)` skips a duplicate with a notice: a file with the same name,
size and `lastModified` as a stored track or an add in progress. It accepts a
file only when its first bytes are an ID3v2 header or an MPEG audio Layer III
frame header, independent of the name and MIME type. The row shows the track
only after the transaction commits. A refused or failed save leaves the library
unchanged and shows a `notMp3`, `quota`, `saveFailed` or `readFailed` notice.
After the first successful file save, the controller calls
`navigator.storage.persist()` once if `navigator.storage.persisted()` is false,
and ignores the result.

`replaceCover(file)` accepts JPEG, PNG and WebP signatures (`imageFormat`). A
refused or failed save keeps the previous cover, and `coverDisplayFailed()`
reports an image that the browser cannot decode without changing stored data.
`remove(row)` follows the [deletion rules](playback.md#deleting-tracks).
Playback errors show a message and never delete data. A notice stays until the
next notice, a successful add, a successful cover save or a later playback
error.

`saveSession()` writes the current track, its position, mute, repeat, shuffle
and the used tracks. Writes are serialized and coalesced, failures are ignored,
and the next trigger writes the newer state. The controller and `App` save:

- every 5 s while playing;
- on pause, at the end of a seek, on a track change, a deletion or a natural
  end;
- when repeat, shuffle, mute or the used tracks change;
- on `pagehide`, when the page becomes hidden, and before an update is applied.

Page-exit writes are best effort. Reopening restores the saved modes and
prepares the saved track at its position, paused; a position outside the
track's duration starts from 0.
