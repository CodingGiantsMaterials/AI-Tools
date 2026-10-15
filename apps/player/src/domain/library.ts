/** Metadata of one stored file; the identifier is generated, never derived from the file name. */
export interface Track {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

/** Track identifier per visible row; `null` is an empty row. Positions never shift. */
export type Slots = readonly (string | null)[];

export const minimumRows = 6;

/** At least six rows and one empty row after the last occupied row. */
export function rowCount(slots: Slots): number {
  let last = -1;
  slots.forEach((id, index) => { if (id !== null) last = index; });
  return Math.max(minimumRows, last + 2);
}

/** Occupied rows in visible order; playback skips empty rows. */
export function trackOrder(slots: Slots): string[] {
  return slots.filter((id): id is string => id !== null);
}

export function withSlot(slots: Slots, index: number, trackId: string | null): Slots {
  const next = Array.from({ length: Math.max(slots.length, index + 1) }, (_, i) => slots[i] ?? null);
  next[index] = trackId;
  return next;
}

type FileIdentity = Pick<Track, 'name' | 'size' | 'lastModified'>;

/** The same name, size and modification time count as a duplicate; contents are not compared. */
export function isDuplicate(existing: Iterable<FileIdentity>, file: FileIdentity): boolean {
  for (const track of existing) {
    if (track.name === file.name && track.size === file.size && track.lastModified === file.lastModified) return true;
  }
  return false;
}
