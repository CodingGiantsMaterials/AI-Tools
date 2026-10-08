import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fixture = path.resolve('tests/fixtures/images/static.png');

test('dispose during header read rejects without starting a provenance worker', async ({ page }) => {
  const createdWorkers: string[] = [];
  page.on('worker', (worker) => createdWorkers.push(worker.url()));
  await page.goto('tests/probe/index.html');
  await page.locator('#file').setInputFiles(fixture);
  const result = await page.evaluate(async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const original = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      return this.size === 12 ? gate.then(() => original.call(this)).finally(() => {
        document.body.dataset.headerReadFinished = 'true';
      }) : original.call(this);
    };
    try {
      const pending = window.probe.provenance();
      window.probe.dispose();
      release();
      return await pending.then(() => 'resolved', (error: DOMException) => error.name);
    } finally { Blob.prototype.arrayBuffer = original; }
  });
  expect(result).toBe('AbortError');
  await expect(page.locator('body')).toHaveAttribute('data-header-read-finished', 'true');
  expect(createdWorkers).toEqual([]);
});

for (const stop of ['timeout', 'dispose', 'abort'] as const) {
  test(`stalled provenance initialization is terminated on ${stop}`, async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        private stalled: boolean;
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          this.stalled = String(url).includes('provenance.worker');
        }
        override postMessage(message: unknown, options?: StructuredSerializeOptions | Transferable[]) {
          if (this.stalled) return;
          if (Array.isArray(options)) super.postMessage(message, options);
          else super.postMessage(message, options);
        }
      };
    });
    await page.goto('tests/probe/index.html');
    await page.locator('#file').setInputFiles(fixture);
    const pending = page.evaluate(async () => {
      const controller = new AbortController();
      Reflect.set(window, 'cancelProvenance', () => controller.abort());
      return window.probe.provenance(controller.signal).then(({ value }) => value.status, (error: DOMException) => error.name);
    });
    await expect.poll(() => page.workers().filter((worker) => worker.url().includes('provenance.worker')).length).toBe(1);
    if (stop === 'timeout') await page.clock.fastForward(20_001);
    else if (stop === 'dispose') await page.evaluate(() => window.probe.dispose());
    else await page.evaluate(() => Reflect.get(window, 'cancelProvenance')());
    expect(await pending).toBe(stop === 'timeout' ? 'error' : 'AbortError');
    await expect.poll(() => page.workers().length).toBe(0);
  });
}

test('worker startup failure releases ownership and allows the next read', async ({ page }) => {
  await page.route('**/assets/provenance.worker-*.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("Deliberate startup failure")' }));
  await page.goto('tests/probe/index.html');
  await page.locator('#file').setInputFiles(fixture);
  expect((await page.evaluate(() => window.probe.provenance())).value.status).toBe('error');
  await expect.poll(() => page.workers().length).toBe(0);
  await page.unroute('**/assets/provenance.worker-*.js');
  expect((await page.evaluate(() => window.probe.provenance())).value.status).toBe('none');
  await expect.poll(() => page.workers().length).toBe(0);
});

test('refresh retains an unchanged native animation and replaces changed bytes', async ({ page }) => {
  await page.goto('https://127.0.0.1:4174/Web-Album/');
  const bytes = Array.from(await readFile(path.resolve('tests/fixtures/images/animated.png')));
  await page.evaluate((originalBytes) => {
    let revisionByte = 0;
    Reflect.set(window, 'replaceFile', () => { revisionByte++; });
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () => ({
      kind: 'directory', queryPermission: async () => 'granted',
      async *values() {
        yield { kind: 'file', name: 'animation.png', getFile: async () =>
          new File([Uint8Array.from(originalBytes), Uint8Array.of(revisionByte)], 'animation.png', { type: 'image/png', lastModified: 1 }) };
      },
    }) });
  }, bytes);
  await page.getByRole('button', { name: 'Wybierz folder' }).click();
  const image = page.locator('main > img');
  await expect(image).toHaveAttribute('src', /^blob:/);
  await image.evaluate((img: HTMLImageElement) => { Reflect.set(window, 'originalImage', img); return img.decode(); });
  const source = await image.getAttribute('src');
  await page.getByRole('button', { name: 'Odśwież' }).click();
  await expect(page.getByRole('button', { name: 'Odśwież' })).toBeEnabled();
  await expect(image).toHaveAttribute('src', source!);
  expect(await image.evaluate((img) => img === Reflect.get(window, 'originalImage'))).toBe(true);
  await page.evaluate(() => Reflect.get(window, 'replaceFile')());
  await page.getByRole('button', { name: 'Odśwież' }).click();
  await expect(page.getByRole('button', { name: 'Odśwież' })).toBeEnabled();
  await expect(image).not.toHaveAttribute('src', source!);
  await image.evaluate((img: HTMLImageElement) => img.decode());
});
