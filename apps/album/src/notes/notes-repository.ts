import { openDatabase } from '@ai-tools/shared/indexed-db';

export interface Note {
  contentId: string;
  text: string;
  updatedAt: number;
  revision: number;
}
export interface NotesStore {
  get(contentId: string): Promise<Note | null>;
  save(note: Note, expectedRevision: number): Promise<void>;
  close(): Promise<void>;
}
export const notesDatabase = { name: 'ai-tools-album', version: 1, store: 'notes' } as const;
export function validContentId(value: string): boolean { return /^[a-f0-9]{64}$/.test(value); }
function validNote(value: unknown): value is Note {
  const note = value as Note | null;
  return !!note && typeof note.contentId === 'string' && validContentId(note.contentId) && typeof note.text === 'string'
    && Number.isSafeInteger(note.revision) && note.revision > 0 && Number.isFinite(note.updatedAt);
}

/** Completion means the entire transaction committed, not merely put.onsuccess. */
export class NotesRepository implements NotesStore {
  private connection: Promise<IDBDatabase> | null = null;
  private closed = false;

  constructor(private readonly factory: IDBFactory = indexedDB, private readonly name: string = notesDatabase.name) {}

  private open(): Promise<IDBDatabase> {
    if (this.closed) return Promise.reject(new Error('NotesClosed'));
    if (this.connection) return this.connection;
    this.connection = openDatabase(this.name, notesDatabase.version, {
      factory: this.factory,
      upgrade: (db) => {
        if (!db.objectStoreNames.contains(notesDatabase.store)) db.createObjectStore(notesDatabase.store, { keyPath: 'contentId' });
      },
      onVersionChange: () => { this.connection = null; },
    }).then((db) => {
      if (this.closed) { db.close(); throw new Error('NotesUnavailable'); }
      return db;
    }).catch(() => { this.connection = null; throw new Error('NotesUnavailable'); });
    return this.connection;
  }

  async get(contentId: string): Promise<Note | null> {
    if (!validContentId(contentId)) throw new Error('InvalidContentId');
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(notesDatabase.store, 'readonly');
      const request = tx.objectStore(notesDatabase.store).get(contentId);
      tx.oncomplete = () => {
        if (request.result === undefined) resolve(null);
        else if (validNote(request.result)) resolve(request.result);
        else reject(new Error('InvalidStoredNote'));
      };
      tx.onabort = tx.onerror = () => reject(new Error('NotesReadFailed'));
    });
  }

  async save(note: Note, expectedRevision: number): Promise<void> {
    if (!validNote(note) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || note.revision <= expectedRevision) throw new Error('InvalidNote');
    const snapshot = { ...note };
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(notesDatabase.store, 'readwrite');
      const store = tx.objectStore(notesDatabase.store);
      const request = store.get(snapshot.contentId);
      let conflict = false;
      request.onsuccess = () => {
        const previous: unknown = request.result;
        if (previous === undefined ? expectedRevision !== 0 : !validNote(previous) || previous.revision !== expectedRevision) {
          conflict = true; tx.abort(); return;
        }
        store.put(snapshot);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error(conflict ? 'NoteConflict' : 'NotesWriteFailed'));
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    const db = await this.connection?.catch(() => null);
    db?.close(); this.connection = null;
  }
}
