# Player

A static browser application that plays MP3 files from your computer. It keeps
one track list and an optional album cover, stores copies of the chosen files in
the browser and works offline after the first visit. The interface supports
Polish, English, German and Spanish, with light and dark themes, in current
desktop versions of Chrome, Edge and Firefox.

The application is published at
[https://codinggiantsmaterials.github.io/AI-Tools/Player/](https://codinggiantsmaterials.github.io/AI-Tools/Player/).

## Using the player

Click the plus in an empty row to add one MP3 file to that row. After the file
is saved, its name replaces the label and a cross deletes it. Tracks never move,
and an empty row always follows the last one. Click the large plus, or the
cover, to choose a JPEG, PNG or WebP image; the cover shows the image's top-left
square. Cancelling a file picker changes nothing.

The first track added appears in the player at the bottom, paused. Clicking
another track while music plays starts it from the beginning; while paused, it
only prepares the track. The player offers play/pause, previous, next, a
progress slider, repeat (off, all tracks, one track), shuffle and mute; the
volume is fixed at half. Deleting the current track stops it and hides the
player until you select another track.

Files that are not MP3 files or supported images, duplicates with the same name,
size and modification time, and files that cannot be saved are refused with a
message; the library stays unchanged.

## Privacy and local data

Files are read in the browser, and the originals are never modified. The library
stays in this browser and is not uploaded: file copies, names, the cover, the
track order and the playback state. There is no backend, account, analytics or
external service. Using the application online still connects to its static
hosting, which records connection data such as IP addresses. This describes
library data; it is not a promise of zero network traffic.

The library is stored in the IndexedDB database `ai-tools-player`. Manually
chosen language and theme use the localStorage keys `ai-tools-player-language`
and `ai-tools-player-theme`; until then, the language follows the browser
(English otherwise). Reopening in the same browser profile and at the same
address restores the library, the last track and its position, paused, with
mute, repeat and shuffle.

Browser storage is not a backup. The application asks once for persistent
storage, which the browser may refuse. Clearing site data, losing the profile or
switching browsers removes the library, and there is no export. All AI-Tools
applications share one origin, storage quota and site data
([shared origin](../../README.md#shared-origin)).

## Offline and updates

After the first complete visit online, a service worker stores the application
files, and a short message says that Player is ready to work offline. The
application then opens and works without a network, including adding files.
Music and the cover come from IndexedDB, not from the service worker cache. The
service worker controls only `/AI-Tools/Player/`.

When a new version is published, the application shows "A new version of Player
is available." with an Update button and keeps playing; nothing reloads by
itself. Update saves the current track, position and modes, then reloads into
the new version with the library restored and playback paused. Updates never
delete the library.

## Development and checks

Run commands from the repository root; the [repository README](../../README.md)
describes the Node.js version, workspace setup and GitHub Pages publication.

```powershell
npm ci
npm run dev -w @ai-tools/player
```

The development server uses HTTPS with a locally generated, self-signed
certificate and registers no service worker. Check the service worker, offline
use and updates on the production preview instead. It serves HTTP on
`127.0.0.1`, which browsers treat as a secure context, because Chrome rejects
service worker registration with the self-signed certificate.

```powershell
npm run build -w @ai-tools/player
npm run preview -w @ai-tools/player
```

The preview serves `dist/Player`, by default at
`http://127.0.0.1:4173/AI-Tools/Player/`. Production assets are built for
`/AI-Tools/Player/` and need only static hosting; the production HTML includes a
CSP.

The [foundation contracts](../../docs/contracts/player/foundation.md) cover the
build, service worker, updates, CSP and network behavior. The
[library and local data contracts](../../docs/contracts/player/local-data.md)
cover storage and the library controller. The
[playback contracts](../../docs/contracts/player/playback.md) cover the audio
controller and playback rules, and the
[interface contract](../../docs/contracts/player/interface.md) covers the UI.
The [shared contract](../../docs/contracts/shared.md) covers the build,
addresses and shared origin.
