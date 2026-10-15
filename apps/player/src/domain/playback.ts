export const repeatModes = ['off', 'all', 'one'] as const;
export type Repeat = typeof repeatModes[number];

/** Saved player state; language and theme are preferences, not session data. */
export interface Session {
  currentTrackId: string | null;
  position: number;
  muted: boolean;
  repeat: Repeat;
  shuffle: boolean;
  /** Tracks used in the current shuffle cycle; it changes only while shuffle is on. */
  used: readonly string[];
}

export const defaultSession: Session = { currentTrackId: null, position: 0, muted: false, repeat: 'off', shuffle: false, used: [] };

/** The repeat button cycles off → all → one → off. */
export function nextRepeat(repeat: Repeat): Repeat {
  return repeatModes[(repeatModes.indexOf(repeat) + 1) % repeatModes.length] ?? 'off';
}

/** A manual change to another track switches repeat-one to repeat-all. */
export function afterManualChange(repeat: Repeat): Repeat {
  return repeat === 'one' ? 'all' : repeat;
}

export type StepReason = 'ended' | 'next' | 'previous';

export interface StepInput {
  /** Occupied track identifiers in visible row order; empty rows are already left out. */
  order: readonly string[];
  current: string | null;
  used: readonly string[];
  repeat: Repeat;
  shuffle: boolean;
  /** A natural end, or the Next or Previous button. */
  reason: StepReason;
  /** A random value in [0, 1) supplied by the caller; these rules never call `Math.random()`. */
  random: number;
}

/**
 * `track`: go to `trackId` (the current one again means from 0); `stop`: pause and rewind the current
 * track; `none`: nothing changes. `used` and `repeat` are the new cycle state in every case.
 */
export type Step =
  | { type: 'track'; trackId: string; used: readonly string[]; repeat: Repeat }
  | { type: 'stop' | 'none'; used: readonly string[]; repeat: Repeat };

/**
 * The repeat and "pseudo-random" rules for a natural end and for Next and Previous.
 *
 * - Repeat-one restarts the track on a natural end, before shuffle. A manual Next or Previous behaves as
 *   repeat-all and switches the mode to it when the track changes.
 * - Previous always takes the previous occupied row of the visible list; at the first row it wraps only
 *   with repeat on.
 * - Without shuffle, the next occupied row follows; after the last row repeat-all wraps and repeat-off
 *   stops.
 * - With shuffle, the choice is an unused track that is not a neighbour of the current one, otherwise any
 *   unused track; first and last rows are neighbours. An exhausted cycle starts a new cycle that avoids the
 *   last track when another exists and prefers its non-neighbours, continuing playback in a loop without
 *   stopping.
 * - The used set changes only in shuffle steps: a shuffle step marks the track it leaves used, so it
 *   is not picked again in the cycle. Without shuffle the set is neither filled nor cleared. Tracks that are
 *   no longer on the list leave it; new tracks are simply not in it.
 */
export function step({ order, current, used: previouslyUsed, repeat, shuffle, reason, random }: StepInput): Step {
  const used = previouslyUsed.filter((id, index) => order.includes(id) && previouslyUsed.indexOf(id) === index);
  const index = current === null ? -1 : order.indexOf(current);
  if (current === null || index < 0) return { type: reason === 'ended' ? 'stop' : 'none', used, repeat };
  if (reason === 'ended' && repeat === 'one') return { type: 'track', trackId: current, used, repeat };

  const manual = reason !== 'ended';
  const mode = manual ? afterManualChange(repeat) : repeat;
  const go = (trackId: string, nextUsed: readonly string[]): Step =>
    ({ type: 'track', trackId, used: nextUsed, repeat: manual && trackId !== current ? mode : repeat });

  if (reason === 'previous') {
    const target = order[index - 1] ?? (mode === 'all' ? order[order.length - 1] : undefined);
    return target === undefined ? { type: 'none', used, repeat } : go(target, used);
  }

  if (!shuffle) {
    const target = order[index + 1] ?? (mode === 'all' ? order[0] : undefined);
    return target === undefined ? { type: 'stop', used, repeat } : go(target, used);
  }
  const usedNow = used.includes(current) ? used : [...used, current];
  const unused = order.filter((id) => !usedNow.includes(id));
  if (unused.length > 0) return go(pick(preferDistant(unused, order, index), random), usedNow);
  const others = order.length > 1 ? order.filter((id) => id !== current) : order;
  return go(pick(preferDistant(others, order, index), random), []);
}

/** Candidates that are not list neighbours of the track at `index`, if any; first and last are neighbours. */
function preferDistant(candidates: readonly string[], order: readonly string[], index: number): readonly string[] {
  const neighbours = [order[(index + 1) % order.length], order[(index - 1 + order.length) % order.length]];
  const distant = candidates.filter((id) => !neighbours.includes(id));
  return distant.length > 0 ? distant : candidates;
}

/** One of `candidates` (never empty) chosen by `random` in [0, 1). */
function pick(candidates: readonly string[], random: number): string {
  const value = Number.isFinite(random) ? random : 0;
  return candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(value * candidates.length)))]!;
}

/** A saved position applies only inside the known duration; anything else starts from 0. */
export function restorablePosition(position: number, duration: number): number {
  return Number.isFinite(position) && Number.isFinite(duration) && position > 0 && position < duration ? position : 0;
}
