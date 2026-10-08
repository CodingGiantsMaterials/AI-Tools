import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);

test('directory selection keeps the read-only picker call inside the user gesture', async ({ page }) => {
  await page.goto('tests/probe/index.html');
  await page.waitForFunction(() => !!window.probe);
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async (options: unknown) => {
      document.body.dataset.pickerOptions = JSON.stringify(options);
      document.body.dataset.userActivation = String(navigator.userActivation.isActive);
      return { kind: 'directory', queryPermission: async () => 'granted', async *values() {
        yield { kind: 'file', name: 'direct.png', getFile: async () => new File(['file'], 'direct.png') };
        yield { kind: 'directory', name: 'nested' };
      } };
    } });
    const button = document.createElement('button');
    button.textContent = 'Read-only picker';
    button.onclick = async () => {
      const source = await window.probe.pickDirectory();
      document.body.dataset.entries = JSON.stringify((await source.list()).map((entry) => entry.name));
    };
    document.body.append(button);
  });
  await page.getByRole('button', { name: 'Read-only picker' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-picker-options', '{"mode":"read"}');
  await expect(page.locator('body')).toHaveAttribute('data-user-activation', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-entries', '["direct.png"]');
});

test('built application runs under the project subpath with a native snapshot folder', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('https://127.0.0.1:4174/Web-Album/');
  await expect(page.getByRole('heading', { name: 'Web Album' })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(path.resolve('tests/fixtures/images'));
  await expect(page.locator('main > img')).toBeVisible();
  await expect(page.getByText('Aby wczytać zmiany w folderze, wybierz go ponownie.')).toBeVisible();
  await expect(page.getByText('Brak C2PA', { exact: true })).toBeVisible();
  expect(requests.some((url) => /\/Web-Album\/assets\/c2pa_worker-[\w-]+\.js$/.test(url))).toBe(true);
  expect(requests.some((url) => /\/Web-Album\/assets\/identity.worker-[\w-]+\.js$/.test(url))).toBe(true);
  expect(requests.some((url) => /\/Web-Album\/assets\/c2pa_bg-[\w-]+\.wasm$/.test(url))).toBe(true);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  await page.getByRole('combobox').selectOption('en');
  await expect(page.getByText('No C2PA', { exact: true })).toBeVisible();
});

test('local SDK reads never request image-supplied resources, including from workers', async ({ browser }, testInfo) => {
  // Bypass CSP deliberately: a forbidden SDK request must be observed, not hidden by policy.
  const context = await browser.newContext({ bypassCSP: true, ignoreHTTPSErrors: true });
  const requests: string[] = [];
  const failures: string[] = [];
  const outboundData: string[] = [];
  context.on('request', (request) => requests.push(request.url()));
  context.on('request', (request) => { if (request.method() !== 'GET' || request.postData()) outboundData.push(request.url()); });
  context.on('requestfailed', (request) => failures.push(request.url()));
  const page = await context.newPage();
  const observations: unknown[] = [];
  try {
    await page.goto('https://127.0.0.1:4173/Web-Album/tests/probe/index.html');
    await page.waitForFunction(() => !!window.probe);
    await context.route('**/privacy-observer-control', (route) => route.fulfill({ body: 'observer control' }));
    await page.evaluate(() => window.probe.networkControl());
    expect(requests.some((url) => url.endsWith('/privacy-observer-control'))).toBe(true);
    await context.unroute('**/privacy-observer-control');
    for (const [name, expected] of [
      ['c2pa/embedded.jpg', 'detected'], ['images/static.png', 'none'],
      ['c2pa/remote.jpg', 'remote'], ['c2pa/no-algorithm.jpg', 'unsupported'],
      ['c2pa/corrupt.jpg', 'error'], ['c2pa/remote-icon.jpg', 'error'],
    ] as const) {
      await page.locator('#file').setInputFiles(fixture(name));
      const raw = await page.evaluate(() => window.probe.raw());
      const result = await page.evaluate(() => window.probe.provenance());
      observations.push({ name, result, raw });
      await testInfo.attach(name.replace('/', '-'), { body: JSON.stringify({ raw, result }), contentType: 'application/json' });
      expect(result.value.status, JSON.stringify(raw).slice(0, 400)).toBe(expected);
      if (name === 'c2pa/remote-icon.jpg') {
        expect(result.value).toMatchObject({ detection: 'present', completeness: 'partial' });
      }
    }
    expect(requests.some((url) => url.endsWith('.wasm'))).toBe(true);
    expect(requests.some((url) => /c2pa_worker.*\.js$/.test(url))).toBe(true);
    expect(requests.filter((value) => {
      const url = new URL(value);
      if (url.protocol === 'blob:' && url.origin === 'https://127.0.0.1:4173') return false;
      return url.origin !== 'https://127.0.0.1:4173' || url.search !== '' || !(
        url.pathname === '/Web-Album/tests/probe/index.html' ||
        url.pathname === '/Web-Album/tests/probe/privacy-observer-control' ||
        /^\/Web-Album\/assets\/(probe|provenance-service|c2pa_worker|c2pa_bg|network.worker)-[\w-]+\.(js|wasm)$/.test(url.pathname)
      );
    })).toEqual([]);
    expect(failures).toEqual([]);
    expect(outboundData).toEqual([]);
    await expect.poll(() => page.workers().length).toBe(0);
  } finally {
    await testInfo.attach('network-and-sdk', { body: JSON.stringify({ requests, failures, observations }, null, 2), contentType: 'application/json' });
    await context.close();
  }
});

test('original-byte identity runs in a worker and is usable as a persistent IndexedDB key', async ({ page }) => {
  await page.goto('tests/probe/index.html');
  const bytes = await readFile(fixture('images/static.png'));
  await page.locator('#file').setInputFiles(fixture('images/static.png'));
  const result = await page.evaluate(() => window.probe.hash());
  expect(result.value).toBe(createHash('sha256').update(bytes).digest('hex'));
  await page.locator('#file').setInputFiles({ name: 'renamed.png', mimeType: 'image/png', buffer: bytes });
  expect((await page.evaluate(() => window.probe.hash())).value).toBe(result.value);
  await page.evaluate(async (contentId) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('web-album-identity-probe', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('notes', { keyPath: 'contentId' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('notes', 'readwrite');
        tx.objectStore('notes').put({ contentId, text: 'local note', revision: 1, updatedAt: 1 });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, result.value);
  await page.reload();
  const text = await page.evaluate(async (contentId) => new Promise<string>((resolve, reject) => {
    const open = indexedDB.open('web-album-identity-probe', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('notes').objectStore('notes').get(contentId);
      request.onsuccess = () => { db.close(); resolve(request.result.text); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }), result.value);
  expect(text).toBe('local note');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('web-album-identity-probe');
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  }));
});

for (const filename of ['animated.png', 'animated.webp']) {
  test(`native original ${filename} keeps animating`, async ({ page }) => {
    await page.goto('tests/probe/index.html');
    await page.locator('#file').setInputFiles(fixture(`images/${filename}`));
    const source = await page.evaluate(() => window.probe.original());
    expect(source).toMatch(/^blob:/);
    await page.locator('#original').evaluate((img: HTMLImageElement) => img.decode());
    const hashes = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const screenshot = await page.locator('#original').screenshot();
      hashes.add(createHash('sha256').update(screenshot).digest('hex'));
      await page.waitForTimeout(100);
    }
    expect(hashes.size).toBeGreaterThan(1);
    const original = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.querySelector<HTMLImageElement>('#original')!.src)).arrayBuffer())));
    expect(Buffer.from(original)).toEqual(await readFile(fixture(`images/${filename}`)));
    expect(await page.locator('#original').getAttribute('src')).toBe(source);
    await page.evaluate(() => window.probe.dispose());
  });
}
