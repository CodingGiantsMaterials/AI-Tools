# Player interface

`App` owns one `AudioController`, one `LibraryController` with its
`LibraryRepository`, the language and theme state and the
[service worker registration](foundation.md#service-worker). It saves the
session on `pagehide` and when the page becomes hidden. The interface consumes
the [library](local-data.md#library-controller) and
[playback](playback.md) contracts.

## Layout

The shared `Header` shows the logo, the update offer while one is pending, and
the language and theme controls. Below it, the cover field sits to the left of
the track list. The list shows exactly six rows and scrolls internally. It
renders `max(6, last occupied row + 2)` rows, so an empty row always follows the
last track. The arrow under the list scrolls instantly by exactly one row per
click and has no disabled state; the mouse wheel scrolls back.

The player panel is fixed to the bottom edge and appears only while a track is
current. The main content reserves the panel's height, so the panel never
covers the list or its arrow, and small windows scroll the page. One layout
unit, `--row` in whole pixels, scales the cover, the rows and the spacing with
the window. The layout targets desktop browsers only.

## Track list

An empty row shows a plus button, a translated label such as `Track 3` and its
own file input (`.mp3,audio/mpeg`, one file). An occupied row has a delete cross
and a separate select button with the file name; buttons are never nested. Long
names truncate with an ellipsis and never push the cross out of the list.
Pending rows show `Saving…` or `Removing…`. The current row has a background,
an accent bar, bold text and `aria-current`.

## Cover

The cover field is a square button with a large plus until a cover exists.
Clicking the cover chooses a replacement image. The image uses
`object-fit: cover` and `object-position: 0 0`, so a landscape image shows its
left square and a portrait image its top square, never stretched. Cropping is
display only; the stored file is unchanged.

## Player panel

The panel holds Previous, Play/Pause, Next, a native range slider, the time,
Repeat, Shuffle and Mute. Clicking or dragging the slider seeks, and its
`change` event saves the position. The time reads `mm:ss / mm:ss` with uncapped
minutes and `00:00` while the duration is unknown. The file name appears on the
list, not in the panel, and there is no stop button or volume slider. Shuffle
and Mute are toggles with `aria-pressed` and constant names; Repeat names its
state and shows a "1" for repeat-one. All controls are native buttons with
translated accessible names, without custom keyboard shortcuts.

## Messages

One `role="status"` line under the content shows, in priority order, the
library notice, the audio error, the loading message and the ready-for-offline
message. A later audio error clears an older notice, so the newer message is
shown. The update offer is a separate `role="status"` element in the header
with its own Update button, so other messages never hide it and it never moves
the content.

## Languages and preferences

`apps/player/src/i18n.ts` provides complete Polish, English, German and European
Spanish dictionaries typed with the shared `MessagesOf`. They cover labels,
accessible names, empty rows, notices and the update offer; file names are
inserted unchanged. On the first visit the language comes from
`browserLanguage()`, with English as the fallback, and the theme is light. Only
manual changes are saved, through the shared preference functions with the
prefix `ai-tools-player`: `ai-tools-player-language` and
`ai-tools-player-theme`. Without storage, preferences stay in memory. Both
themes use the shared tokens. The Player adds `--icon` for icon greys, with at
least 3:1 contrast in both themes on `--surface` and on `--soft`, the
background of the selected row.
