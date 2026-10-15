# Audio and playback rules

## Audio controller

`AudioController` in `apps/player/src/audio/audio-controller.ts` is the only
owner of the application's audio element. It creates one element with
`new Audio()` on first use, outside the DOM, so hiding the player panel never
destroys it. It sets `preload = 'auto'` and `volume = 0.425` once, mutes with
`muted` and never uses `loop`.

`getSnapshot()` returns `AudioState`:

- `trackId`: the current track; `null` hides the panel;
- `status`: `idle`, `preparing`, `paused`, `playing` or `error`, changed only by
  element events and settled operations;
- `playIntent`, `position`, `duration` and `muted`;
- `error`: `load` when the stored file cannot be read, `playback` when the
  browser cannot decode or play it, `play` when `play()` is refused, or `null`.

`subscribe()` serves React. `onEvent()` emits `playing`, `paused`, `ended`,
`progress` and `error` with the track ID. `ended` reports only a natural end,
an end reached while playing; `error` reports each new error.

- `connect()` attaches the element listeners and returns a detach function that
  pauses.
- `prepare(trackId, read, { position, play })` stops the previous sound, reads
  the stored file and starts playback only when `play` is set.
- `play()`, `pause()` (settled at once) and `toggle()` control playback.
- `seek(position)` moves the position and keeps the play state.
- `restart()` plays the same track from 0.
- `stop()` pauses and rewinds; the track stays current.
- `setMuted(muted)` switches mute.
- `clear()` stops, releases the file and deselects the track, which hides the
  panel.

Every `prepare` and `clear` starts a new request. File reads, metadata and
`play()` results of an older request are ignored, so a rapid A → B → C ends on C
with one sound. Each prepared track holds one shared `ObjectUrls` lease,
released when the track changes or clears. A saved position applies after
`loadedmetadata` only when it lies inside the duration, and it never starts
playback. A rejected `play()` other than `AbortError` clears the play intent and
reports `play`.

`isActive(state)` is `status === 'playing' || playIntent`. The play/pause button
and every "while playing" decision below use it, so a click during a track
switch acts on the requested state.

## Selecting tracks

The current track is the selected track shown in the player; it need not be
playing. Stop means pause and rewind: the track stays current and the panel
stays visible.

- Clicking the current row changes nothing.
- Clicking another row starts it from 0 while active; otherwise it is prepared
  from 0 and stays paused.
- Adding a track never starts or switches playback. Only the first track added
  to an empty library becomes current, paused, which shows the panel. Adding
  after the current track was deleted selects nothing while other tracks
  remain; if that deletion emptied the library, the next track added is again
  the first one and becomes current.
- Rows whose add or delete transaction is still running are skipped by row
  clicks, Next, Previous and natural ends.
- Seeking keeps the play state. A paused track seeked to its end stays current
  and paused there, also in browsers that report an end; Play then starts it
  from the beginning. Pause and natural ends never hide the panel.
- Volume stays at 0.425; mute switches the sound off and back to that level.

## Next, Previous and repeat

The repeat button cycles off → all tracks → one track → off. A manual change to
another track by a row click, Next or Previous switches repeat-one to
repeat-all.

Next and Previous start their target from 0 while active and prepare it from 0,
paused, otherwise. They treat repeat-one as repeat-all. When a step returns the
current track, as on a one-track list, the track starts from 0 and plays only
while active.

- A natural end with repeat-one replays the same track from 0, before any
  shuffle rule.
- Next or a natural end without shuffle goes to the next occupied row. After the
  last row, repeat-all and repeat-one (on Next) wrap to the first row;
  repeat-off stops.
- Previous goes to the previous occupied row of the visible list, also with
  shuffle on. At the first row it wraps to the last row with repeat on and
  changes nothing with repeat off.

## Shuffle

The pure function `step()` in `apps/player/src/domain/playback.ts` applies the
repeat and shuffle rules. The controller supplies a random value in [0, 1); the
rules never call `Math.random()`. With shuffle on, they choose the target of
Next and of natural ends:

- Candidates are the occupied rows not yet used in the current cycle.
  Neighbours follow the list order, and the first and last rows are neighbours.
  An unused track that is not a neighbour of the current one is preferred;
  otherwise any unused track is chosen.
- When every track is used, a new cycle starts without stopping: it excludes
  the last track when another exists, prefers its non-neighbours and clears the
  used tracks. Switching the last track (whether through manual Next or track
  advance) in shuffle mode continues playback in a loop without stopping.
- The used tracks change only while shuffle is on. A track becomes used when it
  starts playing, and a shuffle step marks the track it leaves. Toggling shuffle
  never clears them or interrupts playback. Deleted tracks leave the set, and
  new tracks join the cycle as unused. A manual choice may play any track.
- A step taken while a deletion is still running leaves that track out of the
  used tracks. If the deletion then fails, the track counts as unused for the
  rest of the cycle.

## Deleting tracks

The cross deletes without confirmation and never selects or starts its row.
Deleting the current track, playing or paused, stops the sound and hides the
panel at once. The row clears after the transaction commits, and no other track
is selected automatically. Selecting another track shows the panel, paused.
Deleting another track does not interrupt playback. If the transaction fails,
the row keeps its track and a notice appears. Deleting the last track leaves the
panel hidden.
