export interface OpenDatabaseOptions {
  /**
   * Creates or migrates the schema inside the version-change transaction. `oldVersion` is 0 for a new
   * database; apply every migration above it in order. A thrown error aborts the upgrade.
   */
  upgrade: (database: IDBDatabase, oldVersion: number, transaction: IDBTransaction) => void;
  /** Runs after another context requested a newer version and this connection closed. */
  onVersionChange?: () => void;
  /** Milliseconds before an unfinished open rejects; 8000 by default. */
  timeout?: number;
  factory?: IDBFactory;
}

/**
 * Rejects with `Error('DatabaseUnavailable')` when opening fails, is blocked by another connection or
 * times out; a connection that succeeds afterwards is closed. The resolved connection closes itself on
 * `versionchange`, so it never blocks a schema upgrade in another tab.
 */
export function openDatabase(name: string, version: number, { upgrade, onVersionChange, timeout = 8000, factory = indexedDB }: OpenDatabaseOptions): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    let finished = false;
    const fail = () => { if (!finished) { finished = true; clearTimeout(timer); reject(new Error('DatabaseUnavailable')); } };
    const timer = setTimeout(fail, timeout);
    request.onblocked = request.onerror = fail;
    request.onupgradeneeded = (event) => { upgrade(request.result, event.oldVersion, request.transaction!); };
    request.onsuccess = () => {
      const database = request.result;
      if (finished) { database.close(); return; }
      finished = true; clearTimeout(timer);
      database.onversionchange = () => { database.close(); onVersionChange?.(); };
      resolve(database);
    };
  });
}
