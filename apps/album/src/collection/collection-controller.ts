import { sameWork, type WorkKey, type WorkResult } from '../core/work';
import type { FolderSource } from '../files/folder-source';
import { IdentityService } from '../identity/identity-service';
import { imageFormat, type ImageFormat } from '@ai-tools/shared/image-format';
import { compareEntries } from '../metadata/date';
import { emptyMetadata, type Metadata } from '../metadata/metadata';
import { MetadataService } from '../metadata/metadata-service';
import { emptyProvenance, type Provenance } from '../provenance/provenance';
import { ProvenanceService } from '../provenance/provenance-service';

interface Reader<T> {
  read(file: File, key: WorkKey, priority?: number, signal?: AbortSignal): Promise<WorkResult<T>>;
  dispose(): void;
}
interface Hasher {
  hash(file: File, key: WorkKey, priority?: number, signal?: AbortSignal): Promise<WorkResult<string>>;
  dispose(): void;
}
export interface CollectionEntry {
  entryId: string;
  name: string;
  file: File;
  format: ImageFormat;
  key: WorkKey;
  resourceKey: string;
  metadata: Metadata;
  contentId: string | null;
  identityStatus: 'pending' | 'ready' | 'error';
  provenance: Provenance | null;
}
export interface CollectionState {
  folderGeneration: number;
  status: 'no-folder' | 'loading' | 'ready' | 'empty' | 'no-supported' | 'access-denied' | 'error';
  scanning: boolean;
  canRefresh: boolean;
  notice: 'reselect' | null;
  entries: readonly CollectionEntry[];
  activeId: string | null;
  issues: readonly { entryId: string; code: 'unavailable' | 'unsupported' | 'access-denied' }[];
}
export const initialCollection: CollectionState = { folderGeneration: 0, status: 'no-folder', scanning: false,
  canRefresh: false, notice: null, entries: [], activeId: null, issues: [] };

/** One scan plus a coalesced repeat; no UI, sorting, or identity stored by array index. */
export class CollectionController {
  private state: CollectionState = initialCollection;
  private listeners = new Set<() => void>();
  private source: FolderSource | null = null;
  private generation = 0;
  private request = 0;
  private revision = 0;
  private pending: 'check' | 'exact' | null = null;
  private flight: Promise<void> | null = null;
  private scanAbort: AbortController | null = null;
  private backgroundAbort: AbortController | null = null;
  private backgroundFlight: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(private readonly services: { identity: Hasher; metadata: Reader<Metadata>; provenance: Reader<Provenance> } = {
    identity: new IdentityService(), metadata: new MetadataService(), provenance: new ProvenanceService(),
  }) {}

  getSnapshot = (): CollectionState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  async setSource(source: FolderSource): Promise<void> {
    if (this.disposed) return;
    this.source = source;
    this.generation++;
    this.scanAbort?.abort(); this.backgroundAbort?.abort();
    this.publish({ ...initialCollection, folderGeneration: this.generation, status: 'loading',
      canRefresh: source.canRefresh, notice: source.canRefresh ? null : 'reselect' });
    await this.requestScan('exact');
  }

  /** Snapshot imports require the caller to invoke the picker in a new gesture. */
  refresh(): Promise<void> {
    if (!this.source?.canRefresh || this.disposed) return Promise.resolve();
    return this.requestScan('exact');
  }

  activate(entryId: string): Promise<void> {
    if (this.disposed || !this.state.entries.some((entry) => entry.entryId === entryId)) return Promise.resolve();
    this.publish({ ...this.state, activeId: entryId });
    if (this.source?.canRefresh) return this.requestScan('check');
    this.startBackground();
    return Promise.resolve();
  }

  /** Teardown waits for any unabortable source list/read to finish. */
  async dispose(): Promise<void> {
    this.disposed = true; this.pending = null;
    this.scanAbort?.abort(); this.backgroundAbort?.abort();
    this.services.identity.dispose(); this.services.metadata.dispose(); this.services.provenance.dispose();
    this.listeners.clear();
    await Promise.allSettled([this.flight, this.backgroundFlight]);
  }

  private publish(state: CollectionState): void {
    if (this.disposed) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private requestScan(mode: 'check' | 'exact'): Promise<void> {
    this.pending = this.pending === 'exact' ? 'exact' : mode;
    this.backgroundAbort?.abort();
    if (!this.flight) {
      // Start on the next microtask so the flight is set even for synchronous sources.
      this.flight = Promise.resolve().then(async () => {
        while (this.pending && !this.disposed) {
          const next = this.pending; this.pending = null;
          await this.scan(next);
        }
      }).finally(() => {
        this.flight = null;
        if (!this.disposed) { this.publish({ ...this.state, scanning: false }); this.startBackground(); }
      });
    }
    return this.flight;
  }

  private async scan(mode: 'check' | 'exact'): Promise<void> {
    const source = this.source;
    if (!source) return;
    const generation = this.generation;
    const abort = new AbortController(); this.scanAbort = abort;
    const current = () => !abort.signal.aborted && generation === this.generation && !this.disposed;
    this.publish({ ...this.state, scanning: true });
    try {
      const listed = await source.list();
      if (!current()) return;
      const previous = new Map(this.state.entries.map((entry) => [entry.entryId, entry]));
      const entries: CollectionEntry[] = [];
      const issues: CollectionState['issues'][number][] = [];
      // The currently selected image is re-read first; large collections stay bounded.
      listed.sort((a, b) => Number(b.entryId === this.state.activeId) - Number(a.entryId === this.state.activeId));
      for (const item of listed) {
        if (!current()) return;
        try {
          const file = await item.getFile();
          if (!current()) return;
          const old = previous.get(item.entryId);
          const exact = mode === 'exact' || item.entryId === this.state.activeId;
          const attributesEqual = old && old.file.size === file.size && old.file.lastModified === file.lastModified && old.name === item.name;
          if (old && attributesEqual && !exact) { entries.push(old); continue; }
          const key: WorkKey = { folderGeneration: generation, entryId: item.entryId, revision: ++this.revision, requestId: ++this.request };
          let contentId: string | null = null;
          if (old) {
            const hash = async (original: File) => {
              try {
                const result = await this.services.identity.hash(original, key, 1, abort.signal);
                return current() && sameWork(key, result.key) ? result.value : null;
              } catch { return null; }
            };
            const before = old.contentId ?? await hash(old.file);
            contentId = await hash(file);
            if (!current()) return;
            if (before && contentId === before) {
              entries.push({ ...old, contentId, identityStatus: 'ready' });
              continue;
            }
          }
          const format = await imageFormat(file);
          if (!current()) return;
          if (!format) { issues.push({ entryId: item.entryId, code: 'unsupported' }); continue; }
          let metadata = emptyMetadata(file, format, 'error', 'read');
          try {
            const result = await this.services.metadata.read(file, key, 1, abort.signal);
            if (sameWork(key, result.key)) metadata = result.value;
          } catch { /* Metadata failure never excludes a displayable original. */ }
          if (!current()) return;
          entries.push({ entryId: item.entryId, name: item.name, file, format, key,
            resourceKey: JSON.stringify([generation, item.entryId, key.revision]), metadata,
            contentId, identityStatus: contentId ? 'ready' : 'pending', provenance: null });
        } catch (error) {
          if (!current()) return;
          issues.push({ entryId: item.entryId, code: error instanceof DOMException && error.name === 'NotAllowedError' ? 'access-denied' : 'unavailable' });
        }
      }
      if (!current()) return;
      entries.sort((a, b) => compareEntries({ ...a, date: a.metadata.date }, { ...b, date: b.metadata.date }));
      const activeId = entries.some((entry) => entry.entryId === this.state.activeId) ? this.state.activeId : entries[0]?.entryId ?? null;
      this.publish({ ...this.state, entries, activeId, issues,
        status: entries.length ? 'ready' : issues.some((issue) => issue.code === 'access-denied') ? 'access-denied'
          : issues.some((issue) => issue.code === 'unavailable') ? 'error' : listed.length ? 'no-supported' : 'empty' });
    } catch (error) {
      if (current()) this.publish({ ...this.state, status: error instanceof DOMException && error.name === 'NotAllowedError' ? 'access-denied' : 'error' });
    } finally { if (this.scanAbort === abort) this.scanAbort = null; }
  }

  private updateEntry(key: WorkKey, update: Partial<CollectionEntry>, signal: AbortSignal): void {
    if (signal.aborted || this.disposed) return;
    this.publish({ ...this.state, entries: this.state.entries.map((entry) => sameWork(entry.key, key) ? { ...entry, ...update } : entry) });
  }

  private startBackground(): void {
    this.backgroundAbort?.abort();
    if (this.disposed || this.flight) return;
    const abort = new AbortController(); this.backgroundAbort = abort;
    // Await the previous pump's cleanup before handing new tasks to its services.
    this.backgroundFlight = this.backgroundFlight.catch(() => undefined).then(async () => {
      if (abort.signal.aborted) return;
      const active = this.state.entries.find((entry) => entry.entryId === this.state.activeId);
      const inspect = active && !active.provenance ? this.services.provenance.read(active.file, active.key, 1, abort.signal)
        .then((result) => { if (sameWork(active.key, result.key)) this.updateEntry(active.key, { provenance: result.value }, abort.signal); })
        .catch(() => this.updateEntry(active.key, { provenance: emptyProvenance('error') }, abort.signal)) : Promise.resolve();
      const ordered = [...this.state.entries].sort((a, b) => Number(b.entryId === active?.entryId) - Number(a.entryId === active?.entryId));
      for (const entry of ordered) {
        if (abort.signal.aborted) break;
        if (entry.identityStatus !== 'pending') continue;
        try {
          const result = await this.services.identity.hash(entry.file, entry.key, entry === active ? 1 : 0, abort.signal);
          if (sameWork(entry.key, result.key)) this.updateEntry(entry.key, { contentId: result.value, identityStatus: 'ready' }, abort.signal);
        } catch { this.updateEntry(entry.key, { identityStatus: 'error' }, abort.signal); }
      }
      await inspect;
    });
  }
}
