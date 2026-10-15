import { openDatabase } from '@ai-tools/shared/indexed-db';
import type { ReadOnlyDirectoryHandle } from './folder-source';

export const folderDatabase = { name: 'ai-tools-album-folder', version: 1, store: 'handles' } as const;

export class FolderRepository {
  private connection: Promise<IDBDatabase> | null = null;
  private closed = false;

  constructor(private readonly factory: IDBFactory = indexedDB, private readonly name: string = folderDatabase.name) {}

  private open(): Promise<IDBDatabase> {
    if (this.closed) return Promise.reject(new Error('FolderRepositoryClosed'));
    if (this.connection) return this.connection;
    this.connection = openDatabase(this.name, folderDatabase.version, {
      factory: this.factory,
      upgrade: (db) => {
        if (!db.objectStoreNames.contains(folderDatabase.store)) {
          db.createObjectStore(folderDatabase.store, { keyPath: 'id' });
        }
      },
      onVersionChange: () => { this.connection = null; },
    }).then((db) => {
      if (this.closed) { db.close(); throw new Error('FolderUnavailable'); }
      return db;
    }).catch(() => { this.connection = null; throw new Error('FolderUnavailable'); });
    return this.connection;
  }

  async saveHandle(handle: ReadOnlyDirectoryHandle): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(folderDatabase.store, 'readwrite');
      tx.objectStore(folderDatabase.store).put({ id: 'current', handle });
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error('FolderWriteFailed'));
    });
  }

  async loadHandle(): Promise<ReadOnlyDirectoryHandle | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(folderDatabase.store, 'readonly');
      const request = tx.objectStore(folderDatabase.store).get('current');
      tx.oncomplete = () => {
        const result = request.result as { id: string; handle?: ReadOnlyDirectoryHandle } | ReadOnlyDirectoryHandle | undefined;
        if (!result) {
          resolve(null);
        } else if ('handle' in result && result.handle && result.handle.kind === 'directory') {
          resolve(result.handle);
        } else if ('kind' in result && result.kind === 'directory') {
          resolve(result as ReadOnlyDirectoryHandle);
        } else {
          resolve(null);
        }
      };
      tx.onabort = tx.onerror = () => reject(new Error('FolderReadFailed'));
    });
  }

  async clearHandle(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(folderDatabase.store, 'readwrite');
      tx.objectStore(folderDatabase.store).clear();
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error('FolderClearFailed'));
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    const db = await this.connection?.catch(() => null);
    db?.close();
    this.connection = null;
  }
}

export const folderRepository = new FolderRepository();
export function saveHandle(handle: ReadOnlyDirectoryHandle): Promise<void> {
  return folderRepository.saveHandle(handle);
}
export function loadHandle(): Promise<ReadOnlyDirectoryHandle | null> {
  return folderRepository.loadHandle();
}
export function clearHandle(): Promise<void> {
  return folderRepository.clearHandle();
}
