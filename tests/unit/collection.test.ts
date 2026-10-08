import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { CollectionController } from '../../src/collection/collection-controller';
import type { FolderSource, FolderEntry } from '../../src/files/folder-source';
import type { WorkKey } from '../../src/core/work';
import { emptyMetadata } from '../../src/metadata/metadata';
import { captureDate } from '../../src/metadata/date';
import { emptyProvenance } from '../../src/provenance/provenance';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const original = (name: string, byte = 0) => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, byte])], name, { lastModified: 1 });
const entry = (file: File): FolderEntry => ({ entryId: file.name, name: file.name, getFile: async () => file });
const controllers: CollectionController[] = [];
afterEach(async () => { await Promise.all(controllers.splice(0).map((controller) => controller.dispose())); });
function setup() {
  const identity = { hash: vi.fn(async (file: File, key: WorkKey) => ({ key, value: createHash('sha256').update(new Uint8Array(await file.arrayBuffer())).digest('hex') })), dispose: vi.fn() };
  const metadata = { read: vi.fn(async (file: File, key: WorkKey) => ({ key, value: emptyMetadata(file, 'image/png', 'ready', null) })), dispose: vi.fn() };
  const provenance = { read: vi.fn(async (_file: File, key: WorkKey) => ({ key, value: emptyProvenance('none') })), dispose: vi.fn() };
  const controller = new CollectionController({ identity, metadata, provenance }); controllers.push(controller);
  let files = [entry(original('a.png'))];
  const source: FolderSource = { kind: 'directory', canRefresh: true, list: vi.fn(async () => files) };
  return { controller, source, identity, metadata, provenance, files: (next: FolderEntry[]) => { files = next; } };
}

it.each([0, 1, 2, 3, 4, 5, 9, 100])('prepares the complete %i-entry order before ready without awaiting C2PA', async (count) => {
  const t = setup();
  t.files(Array.from({ length: count }, (_, i) => entry(original(`${100 - i}.png`, i))));
  t.metadata.read.mockImplementation(async (file, key) => ({ key, value: { ...emptyMetadata(file, 'image/png', 'ready', null),
    date: captureDate(`2024:01:01 00:00:${String(Number(file.name.split('.')[0]) % 60).padStart(2, '0')}`, 'exif') } }));
  await t.controller.setSource(t.source);
  const state = t.controller.getSnapshot();
  expect(state.entries).toHaveLength(count);
  expect(state.status).toBe(count ? 'ready' : 'empty');
  expect(state.entries.every((entry) => entry.metadata.date !== null)).toBe(true);
  expect(t.metadata.read).toHaveBeenCalledTimes(count);
});

it('atomically reconciles additions, removals and exact replacement with identical attributes', async () => {
  const t = setup(); await t.controller.setSource(t.source);
  await vi.waitFor(() => expect(t.controller.getSnapshot().entries[0]!.contentId).toBeTruthy());
  const first = t.controller.getSnapshot().entries[0]!;
  t.files([entry(original('a.png')), entry(original('b.png', 2))]);
  await t.controller.refresh();
  expect(t.controller.getSnapshot().entries[0]!.resourceKey).toBe(first.resourceKey);
  await t.controller.activate('b.png');
  t.files([entry(original('a.png', 9)), entry(original('b.png', 2)), entry(original('c.png', 3))]);
  await t.controller.refresh();
  const next = t.controller.getSnapshot();
  expect(next.activeId).toBe('b.png');
  expect(next.entries[0]!.resourceKey).not.toBe(first.resourceKey);
  expect(next.entries[0]!.contentId).not.toBe(first.contentId);
  t.files([entry(original('c.png', 3))]); await t.controller.refresh();
  expect(t.controller.getSnapshot().activeId).toBe('c.png');
  expect(t.controller.getSnapshot().entries.some((entry) => entry.entryId === 'b.png')).toBe(false);
});

it('activation rereads current bytes and snapshot activation does not pretend to rescan disk', async () => {
  const t = setup(); t.files([entry(original('a.png')), entry(original('b.png'))]);
  await t.controller.setSource(t.source);
  const before = t.controller.getSnapshot().entries[1]!.key.revision;
  t.files([entry(original('a.png')), entry(original('b.png', 4))]);
  await t.controller.activate('b.png');
  expect(t.controller.getSnapshot().entries[1]!.key.revision).not.toBe(before);
  const list = vi.fn(async () => [entry(original('snapshot.png'))]);
  await t.controller.setSource({ kind: 'snapshot', canRefresh: false, list });
  await t.controller.activate('snapshot.png'); await t.controller.refresh();
  expect(list).toHaveBeenCalledTimes(1);
  expect(t.controller.getSnapshot()).toMatchObject({ canRefresh: false, notice: 'reselect' });
});

it('coalesces rapid scans into one active plus one repeat', async () => {
  const t = setup(); await t.controller.setSource(t.source);
  const gate = deferred<FolderEntry[]>();
  const list = vi.fn().mockImplementationOnce(() => gate.promise).mockResolvedValue([entry(original('a.png'))]);
  t.source.list = list;
  const scan = t.controller.refresh();
  await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  const requests = Array.from({ length: 100 }, () => t.controller.activate('a.png'));
  expect(list).toHaveBeenCalledTimes(1);
  gate.resolve([entry(original('a.png'))]);
  await Promise.all([scan, ...requests]);
  expect(list).toHaveBeenCalledTimes(2);
});

it('drops late work across folder changes, including the same entry name', async () => {
  const t = setup(); const gate = deferred<Awaited<ReturnType<typeof t.metadata.read>>>();
  let oldKey: WorkKey | undefined;
  t.metadata.read.mockImplementationOnce((_file, key) => { oldKey = key; return gate.promise; });
  const first = t.controller.setSource(t.source);
  await vi.waitFor(() => expect(oldKey).toBeDefined());
  const second = t.controller.setSource({ kind: 'snapshot', canRefresh: false, list: async () => [entry(original('a.png', 8))] });
  expect(t.controller.getSnapshot().entries).toEqual([]);
  gate.resolve({ key: oldKey!, value: { ...emptyMetadata(original('old'), 'image/png', 'ready', null), software: ['OLD'] } });
  await Promise.all([first, second]);
  expect(t.controller.getSnapshot().entries[0]!.metadata.software).toEqual([]);
  expect(t.controller.getSnapshot().entries[0]!.key.folderGeneration).toBe(2);
});

it('reports access and per-file failures independently and keeps valid display entries on metadata failure', async () => {
  const t = setup(); t.metadata.read.mockRejectedValue(new Error('metadata'));
  t.files([entry(original('a.png')), { entryId: 'gone', name: 'gone', getFile: async () => { throw new DOMException('', 'NotFoundError'); } }, entry(new File(['text'], 'bad.png'))]);
  await t.controller.setSource(t.source);
  expect(t.controller.getSnapshot()).toMatchObject({ status: 'ready', issues: [{ entryId: 'gone', code: 'unavailable' }, { entryId: 'bad.png', code: 'unsupported' }] });
  expect(t.controller.getSnapshot().entries[0]!.metadata.status).toBe('error');
  t.source.list = async () => { throw new DOMException('', 'NotAllowedError'); };
  await t.controller.refresh();
  expect(t.controller.getSnapshot().status).toBe('access-denied');
});

it('identical copies share content identity but keep separate entry and resource identities', async () => {
  const t = setup(); t.files([entry(original('a.png')), entry(original('copy.png')), entry(original('different.png', 8))]);
  await t.controller.setSource(t.source);
  await vi.waitFor(() => expect(t.controller.getSnapshot().entries.every((entry) => entry.contentId)).toBe(true));
  const [a, b, c] = t.controller.getSnapshot().entries;
  expect(a!.contentId).toBe(b!.contentId); expect(a!.resourceKey).not.toBe(b!.resourceKey);
  expect(a!.contentId).not.toBe(c!.contentId);
});

it('does not apply a late provenance result to a new active revision', async () => {
  const t = setup(); const gate = deferred<Awaited<ReturnType<typeof t.provenance.read>>>();
  let oldKey: WorkKey | undefined;
  t.provenance.read.mockImplementationOnce((_file, key) => { oldKey = key; return gate.promise; });
  await t.controller.setSource(t.source);
  await vi.waitFor(() => expect(oldKey).toBeDefined());
  t.files([entry(original('a.png', 8))]); await t.controller.refresh();
  gate.resolve({ key: oldKey!, value: { ...emptyProvenance('detected'), claimGenerator: 'Stale' } });
  await vi.waitFor(() => expect(t.controller.getSnapshot().entries[0]!.provenance?.status).toBe('none'));
  expect(t.controller.getSnapshot().entries[0]!.provenance?.claimGenerator).toBeNull();
});

it('does not describe an unreadable folder as one containing no supported images', async () => {
  const t = setup();
  t.files([{ entryId: 'denied', name: 'denied', getFile: async () => { throw new DOMException('', 'NotAllowedError'); } }]);
  await t.controller.setSource(t.source);
  expect(t.controller.getSnapshot().status).toBe('access-denied');
});
