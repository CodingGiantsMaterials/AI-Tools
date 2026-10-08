import { NotesRepository, validContentId, type Note, type NotesStore } from './notes-repository';

export interface NotesState {
  contentId: string | null;
  text: string;
  revision: number;
  status: 'identity-pending' | 'loading' | 'ready' | 'dirty' | 'saving' | 'saved' | 'error';
  error: 'read' | 'write' | null;
}
interface Draft { note: Note; savedRevision: number; status: NotesState['status']; error: NotesState['error'] }
const empty: NotesState = { contentId: null, text: '', revision: 0, status: 'identity-pending', error: null };

/** Drafts and callbacks always belong to a content ID, independently of selection. */
export class NotesController {
  private state: NotesState = empty;
  private listeners = new Set<() => void>();
  private drafts = new Map<string, Draft>();
  private loading = new Map<string, Promise<void>>();
  private saving = new Map<string, Promise<void>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private selection = 0;
  private disposed = false;

  constructor(private readonly repository: NotesStore = new NotesRepository(), private readonly debounceMs = 300) {}
  getSnapshot = (): NotesState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  async select(contentId: string | null): Promise<void> {
    if (this.disposed) return;
    if (contentId !== null && !validContentId(contentId)) throw new Error('InvalidContentId');
    if (this.state.contentId) void this.flush(this.state.contentId);
    const selection = ++this.selection;
    this.publish(contentId ? { ...empty, contentId, status: 'loading' } : empty);
    if (!contentId) return;
    if (!this.drafts.has(contentId)) {
      let load = this.loading.get(contentId);
      if (!load) {
        load = this.repository.get(contentId).then((note) => {
          if (this.disposed) return;
          this.drafts.set(contentId, { note: note ?? { contentId, text: '', revision: 0, updatedAt: 0 },
            savedRevision: note?.revision ?? 0, status: note ? 'saved' : 'ready', error: null });
        }).finally(() => this.loading.delete(contentId));
        this.loading.set(contentId, load);
      }
      try { await load; }
      catch {
        if (selection === this.selection) this.publish({ ...empty, contentId, status: 'error', error: 'read' });
        return;
      }
    }
    if (selection === this.selection) this.showDraft(contentId);
  }

  edit(text: string): void {
    const contentId = this.state.contentId;
    const draft = contentId && this.drafts.get(contentId);
    if (this.disposed || !contentId || !draft || text === draft.note.text) return;
    draft.note = { contentId, text, revision: draft.note.revision + 1, updatedAt: Date.now() };
    draft.status = 'dirty'; draft.error = null;
    this.showDraft(contentId);
    this.clearTimer(contentId);
    this.timers.set(contentId, setTimeout(() => { this.timers.delete(contentId); void this.flush(contentId); }, this.debounceMs));
  }

  flush(contentId = this.state.contentId): Promise<void> {
    if (!contentId) return Promise.resolve();
    this.clearTimer(contentId);
    const existing = this.saving.get(contentId);
    if (existing) return existing;
    const run = Promise.resolve().then(async () => {
      const draft = this.drafts.get(contentId);
      if (!draft) return;
      while (draft.note.revision > draft.savedRevision) {
        const snapshot = { ...draft.note };
        draft.status = 'saving'; draft.error = null; this.showDraft(contentId);
        try { await this.repository.save(snapshot, draft.savedRevision); }
        catch { draft.status = 'error'; draft.error = 'write'; this.showDraft(contentId); return; }
        draft.savedRevision = snapshot.revision;
        draft.status = draft.note.revision === snapshot.revision ? 'saved' : 'dirty';
        this.showDraft(contentId);
      }
    }).finally(() => this.saving.delete(contentId));
    this.saving.set(contentId, run);
    return run;
  }

  async flushAll(): Promise<void> { await Promise.all([...this.drafts.keys()].map((id) => this.flush(id))); }

  /** Flush on controlled teardown; pagehide is only best effort, never a saved guarantee. */
  async dispose(): Promise<void> {
    this.disposed = true;
    for (const id of this.timers.keys()) this.clearTimer(id);
    await this.flushAll();
    await Promise.allSettled(this.loading.values());
    await this.repository.close();
    this.listeners.clear();
  }

  private clearTimer(id: string): void { clearTimeout(this.timers.get(id)); this.timers.delete(id); }
  private showDraft(id: string): void {
    const draft = this.drafts.get(id);
    if (draft && this.state.contentId === id) this.publish({ contentId: id, text: draft.note.text, revision: draft.note.revision, status: draft.status, error: draft.error });
  }
  private publish(state: NotesState): void {
    if (this.disposed) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
