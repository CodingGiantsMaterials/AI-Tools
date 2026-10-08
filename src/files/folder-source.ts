export interface FolderEntry {
  /** Stable within this source, separate from content identity. */
  entryId: string;
  name: string;
  getFile(): Promise<File>;
}

export interface FolderSource {
  kind: 'directory' | 'snapshot';
  canRefresh: boolean;
  list(): Promise<FolderEntry[]>;
}

// A deliberately read-only subset, also usable with a test directory handle.
export interface ReadOnlyFileHandle { kind: 'file'; name: string; getFile(): Promise<File> }
export interface ReadOnlyDirectoryHandle {
  kind: 'directory';
  values(): AsyncIterable<ReadOnlyFileHandle | { kind: 'directory'; name: string }>;
  queryPermission(options: { mode: 'read' }): Promise<PermissionState>;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (options: { mode: 'read' }) => Promise<ReadOnlyDirectoryHandle>;
};

export function supportsDirectoryPicker(): boolean {
  return typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

/** Call directly in a user gesture. Background scans never request permission. */
export async function pickDirectory(): Promise<FolderSource> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('DirectoryPickerUnavailable');
  return directorySource(await picker.call(window, { mode: 'read' }));
}

export function directorySource(handle: ReadOnlyDirectoryHandle): FolderSource {
  return {
    kind: 'directory', canRefresh: true,
    async list() {
      if (await handle.queryPermission({ mode: 'read' }) !== 'granted') {
        throw new DOMException('Read access required', 'NotAllowedError');
      }
      const entries: FolderEntry[] = [];
      for await (const child of handle.values()) {
        if (child.kind === 'file') {
          entries.push({ entryId: child.name, name: child.name, getFile: () => child.getFile() });
        }
      }
      return entries;
    },
  };
}

/** webkitdirectory returns a snapshot including descendants; keep root/file only. */
export function snapshotSource(files: Iterable<File>): FolderSource {
  const entries: FolderEntry[] = [];
  for (const file of files) {
    const parts = file.webkitRelativePath.split('/');
    if (parts.length === 2 && parts.every(Boolean)) {
      entries.push({ entryId: file.webkitRelativePath, name: file.name, getFile: async () => file });
    }
  }
  return { kind: 'snapshot', canRefresh: false, list: async () => entries.slice() };
}
