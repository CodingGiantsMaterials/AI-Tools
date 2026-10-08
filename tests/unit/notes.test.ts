import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import { NotesRepository, type Note, type NotesStore } from '../../src/notes/notes-repository';
import { NotesController } from '../../src/notes/notes-controller';

const a = 'a'.repeat(64), b = 'b'.repeat(64);
const note = (contentId: string, revision = 1, text = 'local') => ({ contentId, revision, text, updatedAt: 1 });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('persists revisions by full content ID across reopening and rejects stale writes', async () => {
  const factory = new IDBFactory();
  const first = new NotesRepository(factory); await first.save(note(a, 2)); await first.save(note(b, 1, 'other')); await first.close();
  const reopened = new NotesRepository(factory);
  expect(await reopened.get(a)).toEqual(note(a, 2)); expect(await reopened.get(b)).toEqual(note(b, 1, 'other'));
  await expect(reopened.save(note(a, 1, 'old'))).rejects.toThrow('NoteConflict');
  expect(await reopened.get(a)).toEqual(note(a, 2));
  await expect(reopened.save(note('photo.png'))).rejects.toThrow('InvalidNote');
  await reopened.close();
});

it('does not report put request success as transaction success', async () => {
  const repository = new NotesRepository(new IDBFactory());
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
    const request = put.apply(this, args);
    request.addEventListener('success', () => this.transaction.abort());
    return request;
  });
  await expect(repository.save(note(a))).rejects.toThrow('NotesWriteFailed');
  expect(await repository.get(a)).toBeNull(); await repository.close();
});

it('captures the content and revision before opening the database asynchronously', async () => {
  const repository = new NotesRepository(new IDBFactory());
  const draft = note(a);
  const write = repository.save(draft);
  draft.contentId = b; draft.text = 'changed'; draft.revision = 2;
  await write;
  expect(await repository.get(a)).toEqual(note(a)); expect(await repository.get(b)).toBeNull();
  await repository.close();
});

function memoryStore() {
  const values = new Map<string, Note>();
  const store: NotesStore = { get: vi.fn(async (id) => values.get(id) ?? null), save: vi.fn(async (value) => { values.set(value.contentId, { ...value }); }), close: vi.fn(async () => undefined) };
  return { store, values };
}

it('flushes the correct content and revision on a switch and retains edits made during a write', async () => {
  const { store, values } = memoryStore();
  let finish!: () => void;
  const save = store.save;
  store.save = vi.fn().mockImplementationOnce(async (value: Note) => { await new Promise<void>((resolve) => { finish = resolve; }); await save(value); }).mockImplementation(save);
  const controller = new NotesController(store, 60_000);
  await controller.select(a); controller.edit('first');
  const flush = controller.flush(); await vi.waitFor(() => expect(finish).toBeDefined());
  expect(controller.getSnapshot().status).toBe('saving');
  controller.edit('second'); await controller.select(b); controller.edit('B');
  expect(controller.getSnapshot().text).toBe('B');
  finish(); await flush;
  expect(values.get(a)?.text).toBe('second'); expect(values.get(a)?.revision).toBe(2);
  expect(controller.getSnapshot().contentId).toBe(b);
  await controller.dispose(); expect(values.get(b)?.text).toBe('B');
});

it('retains failed drafts across selection changes and reports saved only after successful retry', async () => {
  const { store, values } = memoryStore(); const save = store.save;
  store.save = vi.fn().mockRejectedValue(new Error('QuotaExceeded'));
  const controller = new NotesController(store, 60_000);
  await controller.select(a); controller.edit('keep me'); await controller.flush();
  expect(controller.getSnapshot()).toMatchObject({ text: 'keep me', status: 'error', error: 'write' });
  await controller.select(b); await controller.select(a);
  expect(controller.getSnapshot().text).toBe('keep me');
  expect(values.has(a)).toBe(false);
  store.save = save; await controller.flush();
  expect(controller.getSnapshot().status).toBe('saved'); expect(values.get(a)?.text).toBe('keep me');
  await controller.dispose();
});

it('clears prior text during identity/load and ignores late reads from a previous selection', async () => {
  const { store } = memoryStore(); let finish!: (value: Note) => void;
  store.get = vi.fn().mockImplementationOnce(() => new Promise<Note>((resolve) => { finish = resolve; })).mockResolvedValue(null);
  const controller = new NotesController(store);
  const old = controller.select(a); await controller.select(b); controller.edit('B');
  finish(note(a, 1, 'A')); await old;
  expect(controller.getSnapshot()).toMatchObject({ contentId: b, text: 'B' });
  await controller.select(null); controller.edit('discard');
  expect(controller.getSnapshot()).toMatchObject({ contentId: null, text: '', status: 'identity-pending' });
  await controller.dispose();
});

it('autosaves after debounce without a manual action', async () => {
  vi.useFakeTimers(); const { store, values } = memoryStore(); const controller = new NotesController(store, 300);
  await controller.select(a); controller.edit('one'); controller.edit('latest');
  expect(controller.getSnapshot().status).toBe('dirty');
  await vi.advanceTimersByTimeAsync(300);
  expect(values.get(a)?.text).toBe('latest'); expect(controller.getSnapshot().status).toBe('saved');
  await controller.dispose();
});

it('keeps read failures distinct from an empty note and prevents overwriting unread data', async () => {
  const { store } = memoryStore(); store.get = vi.fn().mockRejectedValue(new Error('Unavailable'));
  const controller = new NotesController(store);
  await controller.select(a); controller.edit('must not overwrite'); await controller.flush();
  expect(controller.getSnapshot()).toMatchObject({ contentId: a, text: '', status: 'error', error: 'read' });
  expect(store.save).not.toHaveBeenCalled(); await controller.dispose();
});
