import { expect, test, type Page, type Locator } from '@playwright/test';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import { fixtureFile } from './fixture-file';
import { exifChunk, metadataPng, pngChunk, textChunk, xmpChunk, xmpPacket } from '../fixtures/metadata-data';

const app = 'https://127.0.0.1:4174/Web-Album/';
const center = (page: Page) => page.locator('button[data-position="0"]');
const thumbs = (page: Page) => page.getByRole('navigation').locator('button[data-resource-key]');
type LocalFile = { name: string; buffer: Buffer };

async function openFolder(page: Page, files: LocalFile[], snapshot = false) {
  await page.locator('input[type=file]').waitFor({ state: 'attached' });
  const buffers = files.map((file) => ({ name: file.name, bytes: Array.from(file.buffer) }));
  await page.evaluate(({ buffers, snapshot }) => {
    const items = buffers.map(({ name, bytes }) => new File([Uint8Array.from(bytes)], name, { lastModified: 1 }));
    Reflect.set(window, 'galleryFiles', items);
    Reflect.set(window, 'galleryDenied', false);
    if (snapshot) {
      const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
      const transfer = new DataTransfer();
      for (const file of items) {
        Object.defineProperty(file, 'webkitRelativePath', { value: `private-folder/${file.name}` });
        transfer.items.add(file);
      }
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () => ({
        name: 'private-folder', kind: 'directory', queryPermission: async () => Reflect.get(window, 'galleryDenied') ? 'denied' : 'granted',
        async *values() {
          await Reflect.get(window, 'galleryListGate');
          yield { kind: 'directory', name: 'hidden-subfolder' };
          for (const file of Reflect.get(window, 'galleryFiles') as File[]) yield { name: file.name, kind: 'file', getFile: async () => file };
        },
      }) });
    }
  }, { buffers, snapshot });
  if (!snapshot) await page.getByRole('button', { name: /^(Wybierz|Zmień) folder$/ }).click();
}

function landscape(seed: number, width = 2400, height = 1600): Buffer {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const peak = Math.abs(x / width - .5) * .45 + .22 + Math.sin(x / width * 25 + seed) * .055;
    const land = y / height > peak;
    const i = y * (width * 3 + 1) + 1 + x * 3;
    const depth = land ? .45 + y / height * .3 : 1;
    pixels[i] = Math.round((land ? 70 + seed * 8 : 168 + y / height * 40) * depth);
    pixels[i + 1] = Math.round((land ? 99 + seed * 4 : 191 + y / height * 35) * depth);
    pixels[i + 2] = Math.round((land ? 105 + seed * 4 : 213 + y / height * 20) * depth);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header),
    textChunk('Software', 'Local fixture studio'), xmpChunk(xmpPacket('<exif:DateTimeOriginal>2024-06-15T14:32:18+02:00</exif:DateTimeOriginal>')),
    pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))]);
}

test('unique small collections, five positions, looping and rapid retargeting', async ({ page }) => {
  await page.goto(app);
  const file = await fixtureFile('images/static.png');
  for (const length of [1, 2, 3, 4, 5, 9]) {
    await openFolder(page, Array.from({ length }, (_, i) => ({ name: `photo-${i}.png`, buffer: file.buffer })));
    await expect(thumbs(page)).toHaveCount(length);
    const visibleCards = page.locator('button[data-position]:not([aria-hidden="true"])');
    await expect(visibleCards).toHaveCount(Math.min(5, length));
    expect(new Set(await visibleCards.locator('img').evaluateAll((images) => images.map((image) => image.getAttribute('alt')))).size).toBe(Math.min(5, length));
    const next = page.getByRole('button', { name: 'Następne zdjęcie', exact: true });
    if (length === 1) { await expect(next).toBeDisabled(); continue; }
    await page.getByRole('button', { name: 'Poprzednie zdjęcie', exact: true }).click();
    await expect(center(page)).toHaveAttribute('data-entry-id', `photo-${length - 1}.png`);
    await next.click();
    await expect(center(page)).toHaveAttribute('data-entry-id', 'photo-0.png');
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
    await expect(center(page)).toHaveAttribute('data-entry-id', `photo-${12 % length}.png`);
    await page.waitForTimeout(500);
    expect(await center(page).evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await expect(page.getByText('private-folder', { exact: false })).toHaveCount(0);
});

test('side click only selects; center opens contained modal and restores focus', async ({ page }) => {
  await page.goto(app);
  const buffer = landscape(1, 1200, 800);
  await openFolder(page, Array.from({ length: 5 }, (_, i) => ({ name: `photo-${i}.png`, buffer })));
  const side = page.locator('button[data-position="1"]');
  await expect(side).toBeVisible();
  const box = (await side.boundingBox())!;
  await page.mouse.click(box.x + box.width * .8, box.y + box.height / 2);
  await expect(center(page)).toHaveAttribute('data-entry-id', 'photo-1.png');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await center(page).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(modal.getByRole('button')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(center(page)).toHaveAttribute('data-entry-id', 'photo-1.png');
  expect(await modal.locator('img').evaluate((img) => getComputedStyle(img).objectFit)).toBe('contain');
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(center(page)).toBeFocused();
});

test('an open modal follows a replacement revision and closes when its entry disappears', async ({ page }) => {
  await page.goto(app);
  await openFolder(page, [await fixtureFile('images/animated.png'), await fixtureFile('images/static.png')]);
  await expect(center(page)).toHaveAttribute('data-entry-id', 'animated.png');
  const before = await center(page).locator('img').getAttribute('src');
  await page.evaluate(() => {
    const files = Reflect.get(window, 'galleryFiles') as File[];
    files[0] = new File([files[1]!], 'animated.png', { lastModified: 1 });
    Reflect.set(window, 'galleryListGate', new Promise<void>((resolve) => Reflect.set(window, 'releaseGalleryList', resolve)));
  });
  await page.getByRole('button', { name: 'Odśwież', exact: true }).click();
  await center(page).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => Reflect.get(window, 'releaseGalleryList')());
  await expect(page.getByRole('dialog').locator('img')).not.toHaveAttribute('src', before!);
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', (await center(page).locator('img').getAttribute('src'))!);
  await page.keyboard.press('Escape');
  await expect(page.locator('button[data-folder-control]')).toBeFocused();
  await page.evaluate(() => {
    Reflect.set(window, 'galleryFiles', []);
    Reflect.set(window, 'galleryListGate', new Promise<void>((resolve) => Reflect.set(window, 'releaseGalleryList', resolve)));
  });
  await page.getByRole('button', { name: 'Odśwież', exact: true }).click();
  await center(page).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => Reflect.get(window, 'releaseGalleryList')());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Ten folder jest pusty.', { exact: true })).toBeVisible();
  await expect(page.locator('button[data-folder-control]')).toBeFocused();
});

test('notes autosave survives reload, navigation, local failure and editing shortcuts', async ({ page }) => {
  await page.goto(app);
  const files = [{ name: 'a.png', buffer: metadataPng(textChunk('Software', 'A')) }, { name: 'b.png', buffer: metadataPng(textChunk('Software', 'B')) }];
  await openFolder(page, files, true);
  const note = page.getByRole('textbox', { name: 'Notatki' });
  await expect(note).toBeEnabled(); await note.fill('First note'); await note.press('ArrowLeft');
  await expect(center(page)).toHaveAttribute('data-entry-id', 'private-folder/a.png');
  await note.dispatchEvent('keydown', { key: 'ArrowRight', isComposing: true });
  await expect(center(page)).toHaveAttribute('data-entry-id', 'private-folder/a.png');
  await page.getByRole('button', { name: 'Następne zdjęcie', exact: true }).click();
  await expect(note).toHaveValue(''); await expect(note).toBeEnabled(); await note.fill('Second note');
  await expect(page.locator('#note-status')).toHaveText('Zapisano');
  await page.reload(); await openFolder(page, files, true); await expect(note).toHaveValue('First note');
  await page.getByRole('combobox').focus(); await page.getByRole('combobox').press('ArrowLeft');
  await expect(center(page)).toHaveAttribute('data-entry-id', 'private-folder/a.png');
  await page.evaluate(() => {
    const input = document.createElement('div'); input.contentEditable = 'true'; input.id = 'edit-probe'; document.body.append(input); input.focus();
  });
  await page.keyboard.press('ArrowRight'); await expect(center(page)).toHaveAttribute('data-entry-id', 'private-folder/a.png');
  await page.locator('#edit-probe').evaluate((element) => element.remove());
  await page.evaluate(() => {
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
      if (args[1] === 'readwrite') throw new DOMException('Injected storage failure', 'QuotaExceededError');
      return transaction.apply(this, args);
    };
  });
  await note.fill('Retained failed draft');
  await expect(page.locator('#note-status')).toHaveText('Nie udało się zapisać. Szkic pozostaje w pamięci.');
  await expect(note).toHaveValue('Retained failed draft');
  await page.getByRole('combobox').selectOption('de');
  await expect(page.locator('#note-status')).toHaveText('Speichern fehlgeschlagen. Der Entwurf bleibt im Arbeitsspeicher.');
});

test('four languages, two persistent themes, metadata values and copy feedback', async ({ page }) => {
  await page.goto(app);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await openFolder(page, [{ name: 'recorded.png', buffer: metadataPng(textChunk('Software', 'Recorded Original Name'), textChunk('Generator', 'Declared Generator'), exifChunk()) }]);
  await page.getByText('Inne metadane', { exact: true }).click();
  await expect(page.getByText('Recorded Original Name', { exact: true })).toBeVisible();
  await expect(page.getByText('Declared Generator', { exact: true })).toBeVisible();
  await expect(page.getByText('2024-02-29 10:34:56.123456789 UTC', { exact: true })).toBeVisible();
  for (const [code, next, none, dark] of [['en', 'Next photo', 'No C2PA', 'Dark'], ['de', 'Nächstes Foto', 'Kein C2PA', 'Dunkel'], ['es', 'Foto siguiente', 'Sin C2PA', 'Oscuro'], ['pl', 'Następne zdjęcie', 'Brak C2PA', 'Ciemny']]) {
    await page.getByRole('combobox').selectOption(code!);
    await expect(page.getByRole('button', { name: next!, exact: true })).toBeVisible();
    await expect(page.getByText(none!, { exact: true })).toBeVisible();
    await expect(page.getByText('Recorded Original Name', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: dark!, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { document.body.dataset.copied = value; } } }));
  await page.getByRole('button', { name: 'Kopiuj wartość', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-copied', 'recorded.png');
  await expect(page.getByRole('button', { name: 'Skopiowano', exact: true })).toBeVisible();
  await page.getByRole('combobox').selectOption('es'); await expect(page.getByRole('button', { name: 'Copiado', exact: true })).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Injected clipboard failure'); } } }));
  await page.getByRole('button', { name: 'Copiar valor', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'No se pudo copiar. Selecciona el texto para copiarlo.', exact: true })).toBeVisible();
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'es'); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('folder states and visible errors translate without folder names or counts', async ({ page }) => {
  await page.goto(app); await expect(page.getByText('Przyjrzyj się swoim zdjęciom.')).toBeVisible();
  await openFolder(page, []); await expect(page.getByText('Ten folder jest pusty.')).toBeVisible();
  await openFolder(page, [{ name: 'unsupported.txt', buffer: Buffer.from('text') }]);
  await expect(page.getByText('Brak obsługiwanych obrazów w tym folderze.')).toBeVisible();
  await openFolder(page, [await fixtureFile('images/static.png')]); await expect(center(page)).toBeVisible();
  await page.evaluate(() => Reflect.set(window, 'galleryDenied', true));
  await page.getByRole('button', { name: 'Odśwież', exact: true }).click();
  await expect(page.getByText('Odmówiono dostępu do folderu lub go utracono. Wybierz go ponownie.')).toBeVisible();
  await page.getByRole('combobox').selectOption('en');
  await expect(page.getByText('Folder access was denied or lost. Choose it again.')).toBeVisible();
  await expect(center(page).locator('img')).toBeVisible();
  await expect(page.getByText('private-folder', { exact: false })).toHaveCount(0);
});

test('C2PA detection, completeness and read failures remain distinct in the active panel', async ({ page }) => {
  await page.goto(app);
  for (const [name, status] of [['embedded.jpg', 'Wykryto C2PA'], ['remote.jpg', 'Manifest zewnętrzny — nie pobrano'], ['no-algorithm.jpg', 'Nieobsługiwany wariant C2PA'], ['corrupt.jpg', 'Błąd odczytu C2PA'], ['remote-icon.jpg', 'Błąd odczytu C2PA']]) {
    await openFolder(page, [await fixtureFile(`c2pa/${name}`)], true);
    await expect(page.locator('aside [data-status]')).toHaveText(status!);
    if (name === 'remote-icon.jpg') { await expect(page.getByText('Wykryta', { exact: true })).toBeVisible(); await expect(page.getByText('Odczyt częściowy', { exact: true })).toBeVisible(); }
    await expect(center(page)).toBeVisible();
    await expect(page.getByText('Verified', { exact: true })).toHaveCount(0);
  }
});

for (const extension of ['png', 'webp']) {
  test(`original animated ${extension} plays in center, both side depths, thumbnails and modal`, async ({ page }) => {
    if (extension === 'png') await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(app);
    await page.evaluate(() => {
      const originals = new Map<string, Blob>();
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (blob) => { const url = create(blob); if (blob instanceof Blob) originals.set(url, blob); return url; };
      URL.revokeObjectURL = (url) => { originals.delete(url); revoke(url); };
      Reflect.set(window, 'galleryOriginals', originals);
    });
    const fixture = await fixtureFile(`images/animated.${extension}`);
    await openFolder(page, Array.from({ length: 5 }, (_, i) => ({ name: `animation-${i}.${extension}`, buffer: fixture.buffer })), true);
    await expect(center(page)).toBeVisible();
    expect(await center(page).evaluate((button) => getComputedStyle(button).transitionDuration)).toBe('0.42s, 0.42s');
    async function animates(locator: Locator) {
      await locator.evaluate((image: HTMLImageElement) => image.decode());
      const frames = new Set<string>();
      for (let i = 0; i < 6; i++) {
        frames.add(createHash('sha256').update(await locator.screenshot()).digest('hex'));
        await page.waitForTimeout(130);
      }
      expect(frames.size).toBeGreaterThan(1);
      const bytes = await locator.evaluate(async (img: HTMLImageElement) => Array.from(new Uint8Array(await Reflect.get(window, 'galleryOriginals').get(img.src).arrayBuffer())));
      expect(Buffer.from(bytes)).toEqual(fixture.buffer);
    }
    await animates(center(page).locator('img'));
    await animates(page.locator('button[data-position="1"] img'));
    await animates(page.locator('button[data-position="2"] img'));
    await animates(thumbs(page).first().locator('img'));
    await center(page).click(); await animates(page.getByRole('dialog').locator('img')); await page.keyboard.press('Escape');
  });
}

test('native orientation is applied once and transparent originals retain full frames', async ({ page }, testInfo) => {
  await page.goto(app);
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 60;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ff0000'; context.fillRect(0, 0, 60, 30);
    context.fillStyle = '#00ff00'; context.fillRect(60, 0, 60, 30);
    context.fillStyle = '#0000ff'; context.fillRect(0, 30, 60, 30);
    context.fillStyle = '#ffff00'; context.fillRect(60, 30, 60, 30);
    const jpeg = canvas.toDataURL('image/jpeg', 1).split(',')[1]!;
    context.clearRect(0, 0, 60, 60);
    return { jpeg, transparent: canvas.toDataURL('image/png').split(',')[1]! };
  });
  const jpeg = Buffer.from(encoded.jpeg, 'base64');
  for (const [orientation, corner] of [[1, 'red'], [3, 'yellow'], [6, 'blue'], [8, 'green']] as const) {
    const exif = Buffer.concat([Buffer.from('Exif\0\0'), exifChunk(orientation).subarray(8, -4)]);
    const segment = Buffer.alloc(4); segment[0] = 0xff; segment[1] = 0xe1; segment.writeUInt16BE(exif.length + 2, 2);
    await openFolder(page, [{ name: `orientation-${orientation}.jpg`, buffer: Buffer.concat([jpeg.subarray(0, 2), segment, exif, jpeg.subarray(2)]) }], true);
    const image = center(page).locator('img');
    await image.evaluate((img: HTMLImageElement) => img.decode());
    const result = await image.evaluate((img: HTMLImageElement) => {
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d')!; context.drawImage(img, 0, 0);
      const [r, g, b] = context.getImageData(5, 5, 1, 1).data;
      return { width: img.naturalWidth, height: img.naturalHeight, corner: r! > 200 ? g! > 200 ? 'yellow' : 'red' : g! > 200 ? 'green' : b! > 200 ? 'blue' : 'unknown', fit: getComputedStyle(img).objectFit, transform: getComputedStyle(img).transform };
    });
    expect(result).toEqual({ width: orientation < 5 ? 120 : 60, height: orientation < 5 ? 60 : 120, corner, fit: 'contain', transform: 'none' });
  }
  await openFolder(page, [{ name: 'transparent.png', buffer: Buffer.from(encoded.transparent, 'base64') }], true);
  await center(page).locator('img').evaluate((img: HTMLImageElement) => img.decode());
  expect(await center(page).locator('img').evaluate((img) => getComputedStyle(img).backgroundImage)).toContain('repeating-conic-gradient');
  await center(page).click();
  await expect(page.getByRole('dialog').locator('img')).toBeVisible();
  await testInfo.attach('transparent-modal', { body: await page.screenshot(), contentType: 'image/png' });
});

test('production UI keeps untrusted metadata and notes local with CSP bypassed', async ({ browser }) => {
  const assets = new Set((await readdir('dist/assets')).map((name) => `/Web-Album/assets/${name}`));
  const context = await browser.newContext({ bypassCSP: true, ignoreHTTPSErrors: true });
  const requests: { url: string; method: string; data: string | null }[] = [];
  context.on('request', (request) => requests.push({ url: request.url(), method: request.method(), data: request.postData() }));
  const page = await context.newPage();
  try {
    await page.goto(app);
    await openFolder(page, [{ name: 'untrusted.png', buffer: metadataPng(textChunk('Software', '<img src="https://example.invalid/private-image">', true)) }]);
    await page.getByText('Inne metadane', { exact: true }).click();
    await expect(page.getByText('<img src="https://example.invalid/private-image">', { exact: true })).toBeVisible();
    const note = page.getByRole('textbox', { name: 'Notatki' }); await expect(note).toBeEnabled();
    await expect(page.locator('aside [data-status]')).toHaveText('Brak C2PA');
    await page.evaluate(() => {
      let changes = 0;
      const observer = new MutationObserver((mutations) => { changes += mutations.length; });
      observer.observe(document.querySelector('section[aria-label="Karuzela"]')!, { childList: true, subtree: true, attributes: true });
      Reflect.set(window, 'galleryMutations', () => { observer.disconnect(); return changes; });
    });
    await note.pressSequentially('Private local note https://example.invalid/note');
    await expect(page.locator('#note-status')).toHaveText('Zapisano');
    expect(await page.evaluate(() => Reflect.get(window, 'galleryMutations')())).toBe(0);
    expect(requests.filter((request) => {
      const url = new URL(request.url);
      if (url.protocol === 'blob:' && url.origin === new URL(app).origin) return false;
      return url.origin !== new URL(app).origin || url.search !== '' || !(request.url === app || assets.has(url.pathname));
    })).toEqual([]);
    expect(requests.some((request) => request.method !== 'GET' || request.data)).toBe(false);
  } finally { await context.close(); }
});

test('portrait and square thumbnails contain every edge inside their reserved tiles', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto(app);
  const images = await page.evaluate(() => [[1000, 2000], [1000, 1000], [1500, 1000]].map(([width, height], index) => {
    const canvas = document.createElement('canvas'); canvas.width = width!; canvas.height = height!;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#1854a8'; context.fillRect(0, 0, width!, height!);
    context.fillStyle = '#ffe000'; context.fillRect(0, height! * .9, width!, height! * .1);
    return { name: `${index}-frame.png`, base64: canvas.toDataURL('image/png').split(',')[1]! };
  }));
  await openFolder(page, images.map(({ name, base64 }) => ({ name, buffer: Buffer.from(base64, 'base64') })), true);
  await expect(thumbs(page).locator('img')).toHaveCount(3);
  for (const image of await thumbs(page).locator('img').all()) await image.evaluate((img: HTMLImageElement) => img.decode());
  for (const [width, height, label] of [[1536, 1024, 'desktop'], [390, 844, 'mobile'], [320, 600, 'narrow']] as const) {
    await page.setViewportSize({ width, height });
    for (const theme of ['light', 'dark'] as const) {
      await page.getByRole('button', { name: theme === 'light' ? 'Jasny' : 'Ciemny', exact: true }).click();
      const bounds = await thumbs(page).locator('img').evaluateAll((items) => items.map((img) => {
        const image = img.getBoundingClientRect(), tile = img.parentElement!.getBoundingClientRect();
        return { name: img.getAttribute('alt'), image: { x: image.x, y: image.y, width: image.width, height: image.height }, tile: { x: tile.x, y: tile.y, width: tile.width, height: tile.height },
          contained: image.left >= tile.left && image.right <= tile.right && image.top >= tile.top && image.bottom <= tile.bottom,
          fit: getComputedStyle(img).objectFit };
      }));
      await testInfo.attach(`thumbnail-${label}-${theme}-bounds`, { body: JSON.stringify(bounds, null, 2), contentType: 'application/json' });
      await testInfo.attach(`thumbnail-${label}-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      expect(bounds.map((item) => item.name)).toEqual(expect.arrayContaining(['0-frame.png', '1-frame.png']));
      expect(bounds.every((item) => item.contained && item.fit === 'contain')).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  }
});

test('unchanged thumbnails survive additions, removals and another file replacement', async ({ page }, testInfo) => {
  await page.goto(app);
  const png = await fixtureFile('images/animated.png'), webp = await fixtureFile('images/animated.webp');
  await openFolder(page, Array.from({ length: 5 }, (_, index) => ({ name: `${index}.image`, buffer: index % 2 ? webp.buffer : png.buffer })));
  await expect(thumbs(page).locator('img')).toHaveCount(5);
  await page.evaluate(() => {
    Reflect.set(window, 'retainedThumbnails', [...document.querySelectorAll<HTMLImageElement>('nav button[data-resource-key] img')].map((image) => ({ image, name: image.alt, src: image.src })));
    const files = Reflect.get(window, 'galleryFiles') as File[];
    files.push(new File([files[0]!], 'added.image', { lastModified: 1 }));
  });
  const retained = () => page.evaluate(() => (Reflect.get(window, 'retainedThumbnails') as { image: HTMLImageElement; name: string; src: string }[]).map(({ image, name, src }) => ({
    name, connected: image.isConnected, same: [...document.querySelectorAll<HTMLImageElement>('nav button[data-resource-key] img')].find((candidate) => candidate.alt === name) === image, source: image.src === src,
  })));
  const refresh = async () => {
    await page.getByRole('button', { name: 'Odśwież', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Odśwież', exact: true })).toBeEnabled();
  };
  await refresh(); await expect(thumbs(page).locator('img')).toHaveCount(6);
  const afterAddition = await retained();
  await testInfo.attach('thumbnails-after-addition', { body: JSON.stringify(afterAddition, null, 2), contentType: 'application/json' });
  expect(afterAddition.every((item) => item.connected && item.same && item.source)).toBe(true);
  await page.evaluate(() => (Reflect.get(window, 'galleryFiles') as File[]).pop());
  await refresh(); await expect(thumbs(page).locator('img')).toHaveCount(5);
  const afterRemoval = await retained();
  await testInfo.attach('thumbnails-after-removal', { body: JSON.stringify(afterRemoval, null, 2), contentType: 'application/json' });
  expect(afterRemoval.every((item) => item.connected && item.same && item.source)).toBe(true);
  await page.evaluate(() => {
    const files = Reflect.get(window, 'galleryFiles') as File[];
    files[1] = new File([files[0]!], files[1]!.name, { lastModified: 1 });
  });
  await refresh(); await expect(thumbs(page).locator('img')).toHaveCount(5);
  const final = await retained();
  await testInfo.attach('thumbnails-after-replacement', { body: JSON.stringify(final, null, 2), contentType: 'application/json' });
  expect(final.filter((item) => item.name !== '1.image').every((item) => item.connected && item.same && item.source)).toBe(true);
  expect(final.find((item) => item.name === '1.image')).toMatchObject({ connected: false, same: false });
});

test('100 realistic entries bound original resources, retain scrolling and save visual evidence', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto(app);
  const landscapes = Array.from({ length: 9 }, (_, i) => landscape(i));
  const files = Array.from({ length: 100 }, (_, i) => ({ name: `landscape-${String(i).padStart(3, '0')}.png`, buffer: landscapes[i % 9]! }));
  files[49] = { name: 'landscape-049.png', buffer: (await fixtureFile('images/animated.png')).buffer };
  files[50] = { name: 'landscape-050.webp', buffer: (await fixtureFile('images/animated.webp')).buffer };
  await page.addInitScript(() => {
    const live = new Set<string>(); let peak = 0;
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const url = create(blob); live.add(url); peak = Math.max(peak, live.size); return url; };
    URL.revokeObjectURL = (url) => { live.delete(url); revoke(url); };
    Reflect.set(window, 'urlStats', () => ({ live: live.size, peak }));
  });
  await page.reload(); await openFolder(page, files, true); await expect(thumbs(page)).toHaveCount(100, { timeout: 30_000 });
  await expect.poll(() => page.locator('img[src^="blob:"]').count()).toBeLessThan(25);
  const samples: unknown[] = [];
  for (let round = 0; round < 3; round++) {
    for (const index of [0, 20, 40, 60, 80, 99, 50]) {
      await thumbs(page).nth(index).evaluate((button: HTMLButtonElement) => button.click());
      await expect(thumbs(page).nth(index)).toHaveAttribute('aria-current', 'true');
      const pageScroll = await page.evaluate(() => window.scrollY);
      expect(pageScroll).toBe(0);
      await expect.poll(() => page.locator('img[src^="blob:"]').count()).toBeLessThan(25);
      await page.waitForTimeout(80);
    }
    samples.push(await page.evaluate(() => ({ ...Reflect.get(window, 'urlStats')(), memory: Reflect.get(performance, 'memory')?.usedJSHeapSize ?? null, mounted: document.querySelectorAll('img[src^="blob:"]').length })));
  }
  await thumbs(page).nth(4).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('aside [data-status]')).toHaveText('Brak C2PA'); await page.waitForTimeout(500);
  const logo = page.getByRole('img', { name: 'Coding Giants' });
  expect(await logo.evaluate(async (img: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())))).toEqual(Array.from(await readFile('src/assets/coding-giants-small-logo.png')));
  await testInfo.attach('resource-samples', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  await testInfo.attach('desktop-light', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Ciemny', exact: true }).click();
  await testInfo.attach('desktop-dark', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect.poll(() => thumbs(page).nth(4).evaluate((button) => {
    const bounds = button.getBoundingClientRect(), viewport = button.parentElement!.getBoundingClientRect();
    return bounds.left >= viewport.left && bounds.right <= viewport.right;
  })).toBe(true);
  await testInfo.attach('mobile-dark', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Jasny', exact: true }).click();
  await testInfo.attach('mobile-light', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await center(page).click();
  await testInfo.attach('mobile-modal', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await openFolder(page, []);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'urlStats')().live)).toBe(0);
});
