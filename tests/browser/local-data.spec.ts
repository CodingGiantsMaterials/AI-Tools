import { expect, test } from '@playwright/test';
import { fixtureFile } from './fixture-file';
import { metadataPng, textChunk, xmpChunk, xmpPacket, iccChunk, exifChunk, xmpHistory, pngChunk } from '../fixtures/metadata-data';

test('production metadata worker reads PNG compressed blocks, capture date and untrusted text', async ({ page }) => {
  await page.goto('tests/probe/index.html');
  await page.locator('#file').setInputFiles({ name: 'wrong-extension.jpg', mimeType: 'image/jpeg', buffer: metadataPng(
    textChunk('Software', 'Saved editor', true), xmpChunk(xmpPacket('<exif:DateTimeOriginal>2024-02-29T08:09:10.123456+02:00</exif:DateTimeOriginal>' + xmpHistory)),
  ) });
  const result = await page.evaluate(() => window.probe.metadata());
  expect(result.value).toMatchObject({ status: 'ready', format: 'image/png', width: 32, height: 32,
    date: { source: 'xmp', offset: '+02:00', fraction: '123456' }, software: ['Saved editor'], recordedHistory: ['created', 'Editor', '2024-01-01T00:00:00Z'] });
  await page.locator('#file').setInputFiles({ name: 'exif-icc.png', mimeType: 'image/png', buffer: metadataPng(exifChunk(), iccChunk()) });
  expect((await page.evaluate(() => window.probe.metadata())).value).toMatchObject({ status: 'ready', orientation: 6, colorProfile: 'Test RGB profile', date: { source: 'exif', fraction: '123456789' } });
  await expect.poll(() => page.workers().length).toBe(0);
});

test('production metadata worker reports malformed text headers without blocking original display', async ({ page }) => {
  await page.goto('tests/probe/index.html');
  for (const [type, data] of [['tEXt', 'Software'], ['iTXt', 'Software\0\0\0missing-language-terminator']]) {
    await page.locator('#file').setInputFiles({ name: 'corrupt-metadata.png', mimeType: 'image/png', buffer: metadataPng(pngChunk(type!, Buffer.from(data!))) });
    expect((await page.evaluate(() => window.probe.metadata())).value).toMatchObject({ status: 'error', reason: 'read' });
  }
  await page.evaluate(() => window.probe.original());
  await page.locator('#original').evaluate((img: HTMLImageElement) => img.decode());
  await page.evaluate(() => window.probe.dispose());
  await expect.poll(() => page.workers().length).toBe(0);
});

test('stalled metadata read times out and releases its owned worker', async ({ page }) => {
  await page.clock.install();
  await page.route('**/assets/metadata.worker-*.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'self.onmessage = () => {};' }));
  await page.goto('tests/probe/index.html');
  await page.locator('#file').setInputFiles(await fixtureFile('images/static.png'));
  const pending = page.evaluate(() => window.probe.metadata());
  await expect.poll(() => page.workers().length).toBe(1);
  await page.clock.fastForward(10_001);
  expect((await pending).value).toMatchObject({ status: 'error', reason: 'timeout' });
  await expect.poll(() => page.workers().length).toBe(0);
});

test('production notes survive reopening and retain content identity across renamed copies', async ({ page }) => {
  await page.goto('tests/probe/index.html');
  const fixture = await fixtureFile('images/static.png');
  await page.locator('#file').setInputFiles(fixture);
  const hash = (await page.evaluate(() => window.probe.hash())).value;
  await page.evaluate(async (contentId) => {
    const notes = window.probe.createNotes();
    await notes.select(contentId);
    notes.edit('persisted original note');
    await notes.flush();
    if (notes.getSnapshot().status !== 'saved') throw new Error('NoteNotCommitted');
    await notes.dispose();
  }, hash);
  await page.reload();
  await page.locator('#file').setInputFiles({ ...fixture, name: 'renamed.png' });
  expect((await page.evaluate(() => window.probe.hash())).value).toBe(hash);
  const state = await page.evaluate(async (contentId) => {
    const notes = window.probe.createNotes();
    await notes.select(contentId); const result = notes.getSnapshot(); await notes.dispose(); return result;
  }, hash);
  expect(state).toMatchObject({ contentId: hash, text: 'persisted original note', status: 'saved', revision: 1 });
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('web-album-local-notes');
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  }));
});

test('100 original entries load without image decoding and finish bounded background work', async ({ page }) => {
  await page.goto('tests/probe/index.html');
  await page.locator('#file').setInputFiles(await fixtureFile('images/animated.webp'));
  const result = await page.evaluate(async () => {
    const file = document.querySelector<HTMLInputElement>('#file')!.files![0]!;
    const collection = window.probe.createCollection();
    let maxWorkers = 0;
    const NativeWorker = window.Worker;
    let workers = 0;
    window.Worker = class extends NativeWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) { super(...args); workers++; maxWorkers = Math.max(maxWorkers, workers); }
      override terminate() { workers--; super.terminate(); }
    };
    try {
      await collection.setSource({ kind: 'snapshot', canRefresh: false, list: async () => Array.from({ length: 100 }, (_, i) => ({ entryId: `entry-${i}`, name: `file-${i}.webp`, getFile: async () => file })) });
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { unsubscribe(); reject(new Error('BackgroundIncomplete')); }, 45_000);
        const unsubscribe = collection.subscribe(() => {
          if (collection.getSnapshot().entries.every((entry) => entry.identityStatus === 'ready')) {
            clearTimeout(timeout); unsubscribe(); resolve();
          }
        });
      });
      return { entries: collection.getSnapshot().entries.length, identities: new Set(collection.getSnapshot().entries.map((entry) => entry.contentId)).size,
        resources: new Set(collection.getSnapshot().entries.map((entry) => entry.resourceKey)).size, maxWorkers };
    } finally { await collection.dispose(); window.Worker = NativeWorker; }
  });
  expect(result).toMatchObject({ entries: 100, identities: 1, resources: 100 });
  expect(result.maxWorkers).toBeLessThanOrEqual(2);
  await expect.poll(() => page.workers().length).toBe(0);
});
