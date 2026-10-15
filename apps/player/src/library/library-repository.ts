import type { ImageFormat } from '@ai-tools/shared/image-format';
import { openDatabase } from '@ai-tools/shared/indexed-db';
import type { Slots, Track } from '../domain/library';
import { defaultSession, repeatModes, type Session } from '../domain/playback';

export const libraryDatabase = { name: 'ai-tools-player', version: 1 } as const;
const store = { tracks: 'tracks', audio: 'audioBlobs', slots: 'slots', cover: 'cover', session: 'session' } as const;
const maximumRows = 1000;

export interface Cover { imageId: string; format: ImageFormat; blob: Blob }
export interface StoredLibrary { tracks: Track[]; slots: Slots; cover: Cover | null; session: Session }

export type LibraryErrorCode = 'unavailable' | 'read' | 'write' | 'quota' | 'conflict' | 'missing';
export class LibraryError extends Error {
  readonly code: LibraryErrorCode;
  constructor(code: LibraryErrorCode) { super(`Library: ${code}`); this.name = 'LibraryError'; this.code = code; }
}

export interface LibraryStore {
  load(): Promise<StoredLibrary>;
  addTrack(track: Track, file: Blob, index: number): Promise<void>;
  deleteTrack(trackId: string, index: number): Promise<void>;
  replaceCover(cover: Cover): Promise<void>;
  saveSession(session: Session): Promise<void>;
  readAudio(trackId: string): Promise<Blob>;
}

interface SlotRecord { index: number; trackId: string }
interface AudioRecord { trackId: string; blob: Blob }

const imageFormats: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 100;
const validIndex = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < maximumRows;
function validTrack(value: unknown): value is Track {
  const track = value as Track | null;
  return !!track && validId(track.id) && typeof track.name === 'string' && typeof track.type === 'string'
    && Number.isSafeInteger(track.size) && track.size >= 0 && Number.isFinite(track.lastModified);
}
function validSlot(value: unknown): value is SlotRecord {
  const slot = value as SlotRecord | null;
  return !!slot && validIndex(slot.index) && validId(slot.trackId);
}
function validCover(value: unknown): value is Cover {
  const cover = value as Cover | null;
  return !!cover && validId(cover.imageId) && imageFormats.includes(cover.format) && cover.blob instanceof Blob;
}

/** Shape-checks stored records and drops anything that does not reference an existing, placed track. */
function reconcile(trackValues: unknown[], slotValues: unknown[], coverValue: unknown, sessionValue: unknown): StoredLibrary {
  const known = new Map(trackValues.filter(validTrack).map((track) => [track.id, track]));
  const slots: (string | null)[] = [];
  const tracks: Track[] = [];
  for (const slot of slotValues.filter(validSlot).sort((a, b) => a.index - b.index)) {
    const track = known.get(slot.trackId);
    if (!track || slots[slot.index] !== undefined || tracks.includes(track)) continue;
    while (slots.length < slot.index) slots.push(null);
    slots[slot.index] = track.id;
    tracks.push(track);
  }
  const placed = new Set(tracks.map((track) => track.id));
  const saved = (sessionValue ?? {}) as Partial<Record<keyof Session, unknown>>;
  const session: Session = {
    currentTrackId: typeof saved.currentTrackId === 'string' && placed.has(saved.currentTrackId) ? saved.currentTrackId : null,
    position: typeof saved.position === 'number' && Number.isFinite(saved.position) && saved.position > 0 ? saved.position : 0,
    muted: typeof saved.muted === 'boolean' ? saved.muted : defaultSession.muted,
    repeat: repeatModes.find((mode) => mode === saved.repeat) ?? defaultSession.repeat,
    shuffle: typeof saved.shuffle === 'boolean' ? saved.shuffle : defaultSession.shuffle,
    used: Array.isArray(saved.used) ? [...new Set(saved.used.filter((id): id is string => typeof id === 'string' && placed.has(id)))] : [],
  };
  if (!session.currentTrackId) session.position = 0;
  return { tracks, slots, cover: validCover(coverValue) ? coverValue : null, session };
}

function failure(error: DOMException | null, mode: IDBTransactionMode): LibraryError {
  return new LibraryError(error?.name === 'QuotaExceededError' ? 'quota' : mode === 'readonly' ? 'read' : 'write');
}

/**
 * Library data in IndexedDB. Files are validated and prepared before a transaction starts; a transaction
 * issues only IndexedDB requests, and an operation succeeds only when the whole transaction completes.
 */
export class LibraryRepository implements LibraryStore {
  private connection: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory;
  private readonly databaseName: string;

  constructor(factory: IDBFactory = indexedDB, databaseName: string = libraryDatabase.name) {
    this.factory = factory;
    this.databaseName = databaseName;
  }

  load(): Promise<StoredLibrary> {
    return this.transaction([store.tracks, store.slots, store.cover, store.session], 'readonly', (tx) => {
      const tracks = tx.objectStore(store.tracks).getAll();
      const slots = tx.objectStore(store.slots).getAll();
      const cover = tx.objectStore(store.cover).get(store.cover);
      const session = tx.objectStore(store.session).get(store.session);
      return () => reconcile(tracks.result, slots.result, cover.result, session.result);
    });
  }

  /** Stores the file itself with its metadata and row in one transaction; an occupied row is a conflict. */
  addTrack(track: Track, file: Blob, index: number): Promise<void> {
    if (!validTrack(track) || !validIndex(index) || !(file instanceof Blob)) return Promise.reject(new LibraryError('write'));
    const record = { ...track };
    return this.transaction([store.tracks, store.audio, store.slots], 'readwrite', (tx, fail) => {
      const tracks = tx.objectStore(store.tracks);
      const slots = tx.objectStore(store.slots);
      const write = () => {
        tracks.add(record);
        tx.objectStore(store.audio).add({ trackId: record.id, blob: file } satisfies AudioRecord);
        slots.put({ index, trackId: record.id } satisfies SlotRecord);
      };
      const slot = slots.get(index);
      slot.onsuccess = () => {
        if (!validSlot(slot.result)) { write(); return; }
        // A row that references a missing track is reusable; another tab's track is not overwritten.
        const owner = tracks.count(slot.result.trackId);
        owner.onsuccess = () => { if (owner.result) fail('conflict'); else write(); };
      };
      return () => undefined;
    });
  }

  deleteTrack(trackId: string, index: number): Promise<void> {
    if (!validId(trackId) || !validIndex(index)) return Promise.reject(new LibraryError('write'));
    return this.transaction([store.tracks, store.audio, store.slots], 'readwrite', (tx) => {
      tx.objectStore(store.tracks).delete(trackId);
      tx.objectStore(store.audio).delete(trackId);
      const slots = tx.objectStore(store.slots);
      const slot = slots.get(index);
      slot.onsuccess = () => { if (validSlot(slot.result) && slot.result.trackId === trackId) slots.delete(index); };
      return () => undefined;
    });
  }

  replaceCover(cover: Cover): Promise<void> {
    if (!validCover(cover)) return Promise.reject(new LibraryError('write'));
    const record = { id: store.cover, imageId: cover.imageId, format: cover.format, blob: cover.blob };
    return this.transaction([store.cover], 'readwrite', (tx) => { tx.objectStore(store.cover).put(record); return () => undefined; });
  }

  /**
   * The last write wins; there is no cross-tab conflict detection for the session. The transaction commits at once:
   * a write issued during page exit (`pagehide`) is otherwise discarded when Chromium unloads the document.
   */
  saveSession(session: Session): Promise<void> {
    const record = { id: store.session, ...session, used: [...session.used] };
    return this.transaction([store.session], 'readwrite', (tx) => { tx.objectStore(store.session).put(record); tx.commit(); return () => undefined; });
  }

  readAudio(trackId: string): Promise<Blob> {
    if (!validId(trackId)) return Promise.reject(new LibraryError('missing'));
    return this.transaction([store.audio], 'readonly', (tx, fail) => {
      const request = tx.objectStore(store.audio).get(trackId);
      request.onsuccess = () => { const value = request.result as AudioRecord | undefined; if (!(value?.blob instanceof Blob)) fail('missing'); };
      return () => (request.result as AudioRecord).blob;
    });
  }

  private open(): Promise<IDBDatabase> {
    this.connection ??= openDatabase(this.databaseName, libraryDatabase.version, {
      factory: this.factory,
      // Migrations run in order from `oldVersion`; a later version adds an `oldVersion < n` step that keeps stored data.
      // An upgrade never deletes the database.
      upgrade: (db, oldVersion) => {
        if (oldVersion < 1) {
          db.createObjectStore(store.tracks, { keyPath: 'id' });
          db.createObjectStore(store.audio, { keyPath: 'trackId' });
          db.createObjectStore(store.slots, { keyPath: 'index' });
          db.createObjectStore(store.cover, { keyPath: 'id' });
          db.createObjectStore(store.session, { keyPath: 'id' });
        }
      },
      onVersionChange: () => { this.connection = null; },
    }).catch(() => { this.connection = null; throw new LibraryError('unavailable'); });
    return this.connection;
  }

  /**
   * Runs `issue` synchronously inside one transaction. Its returned reader runs only after `complete`;
   * `fail` aborts with a specific code. Abort or error reports `QuotaExceededError` separately.
   */
  private async transaction<T>(scope: string[], mode: IDBTransactionMode,
    issue: (tx: IDBTransaction, fail: (code: LibraryErrorCode) => void) => () => T): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(scope, mode); } catch { this.connection = null; reject(new LibraryError(mode === 'readonly' ? 'read' : 'write')); return; }
      let code: LibraryErrorCode | null = null;
      const fail = (reason: LibraryErrorCode) => { code = reason; tx.abort(); };
      let read: () => T;
      tx.oncomplete = () => {
        try { resolve(read()); } catch { reject(new LibraryError('read')); }
      };
      tx.onabort = () => reject(code ? new LibraryError(code) : failure(tx.error, mode));
      try { read = issue(tx, fail); }
      catch (error) {
        code = error instanceof DOMException && error.name === 'QuotaExceededError' ? 'quota' : mode === 'readonly' ? 'read' : 'write';
        try { tx.abort(); } catch { /* Already finished. */ }
        reject(new LibraryError(code));
      }
    });
  }
}
