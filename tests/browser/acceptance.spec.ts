import { expect, test, type Page } from '@playwright/test';
import { fixtureFile } from './fixture-file';

const app = 'https://127.0.0.1:4174/Web-Album/';
const center = (page: Page) => page.locator('button[data-position="0"]');

async function snapshot(page: Page, paths: string[]) {
  const file = await fixtureFile('images/static.png');
  await page.locator('input[type=file]').waitFor({ state: 'attached' });
  await page.evaluate(({ bytes, paths }) => {
    const transfer = new DataTransfer();
    for (const path of paths) {
      const file = new File([Uint8Array.from(bytes)], path.split('/').at(-1)!, { lastModified: 1 });
      Object.defineProperty(file, 'webkitRelativePath', { value: path });
      transfer.items.add(file);
    }
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { bytes: Array.from(file.buffer), paths });
}

test('fallback gesture, direct-child filtering, cancellation and reported empty selections stay distinct', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined }));
  await page.goto(app);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Wybierz folder', exact: true }).click();
  const fileChooser = await chooser;
  expect(fileChooser.isMultiple()).toBe(true);
  await snapshot(page, ['hidden-root/a.png', 'hidden-root/nested/b.png']);
  await expect(center(page)).toHaveAttribute('data-entry-id', 'hidden-root/a.png');
  await expect(page.getByRole('navigation').locator('button[data-resource-key]')).toHaveCount(1);
  await expect(page.getByText('Aby wczytać zmiany w folderze, wybierz go ponownie.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Odśwież', exact: true })).toHaveCount(0);
  await page.locator('input[type=file]').dispatchEvent('cancel');
  await expect(center(page)).toHaveAttribute('data-entry-id', 'hidden-root/a.png');
  await snapshot(page, []);
  await expect(page.getByText('Ten folder jest pusty.', { exact: true })).toBeVisible();
  await expect(center(page)).toHaveCount(0);
  await snapshot(page, ['hidden-root/nested/b.png']);
  await expect(page.getByText('Ten folder jest pusty.', { exact: true })).toBeVisible();
  await expect(page.getByText('hidden-root', { exact: false })).toHaveCount(0);
});

test('directory picker cancellation preserves originals and denial is translated', async ({ page }) => {
  await page.goto(app); await snapshot(page, ['private/a.png']);
  const original = await center(page).locator('img').getAttribute('src');
  await page.evaluate(() => Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () => { throw new DOMException('Cancelled', 'AbortError'); } }));
  await page.getByRole('button', { name: 'Zmień folder', exact: true }).click();
  await expect(center(page).locator('img')).toHaveAttribute('src', original!);
  await page.evaluate(() => Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () => { throw new DOMException('Denied', 'NotAllowedError'); } }));
  await page.getByRole('button', { name: 'Zmień folder', exact: true }).click();
  await expect(page.getByText('Odmówiono dostępu do folderu lub go utracono. Wybierz go ponownie.')).toBeVisible();
  await page.getByRole('combobox').selectOption('es');
  await expect(page.getByText('Se denegó o perdió el acceso a la carpeta. Elígela de nuevo.')).toBeVisible();
  await expect(center(page).locator('img')).toHaveAttribute('src', original!);
});

test('language and theme layouts retain accessible controls on a narrow screen with unchanged motion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(app); await snapshot(page, Array.from({ length: 9 }, (_, i) => `private/${i}.png`));
  await expect(center(page)).toBeVisible();
  const transition = () => center(page).evaluate((element) => getComputedStyle(element).transitionDuration);
  const normalMotion = await transition();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await transition()).toBe(normalMotion);
  expect(normalMotion).not.toMatch(/^0s(?:, 0s)*$/);
  const languages = [
    { code: 'pl', light: 'Jasny', dark: 'Ciemny', carousel: 'Karuzela', comparison: 'Porównanie' },
    { code: 'en', light: 'Light', dark: 'Dark', carousel: 'Carousel', comparison: 'Comparison' },
    { code: 'de', light: 'Hell', dark: 'Dunkel', carousel: 'Karussell', comparison: 'Vergleich' },
    { code: 'es', light: 'Claro', dark: 'Oscuro', carousel: 'Carrusel', comparison: 'Comparación' },
  ];
  for (const language of languages) {
    await page.getByRole('combobox').selectOption(language.code);
    await expect(page.locator('html')).toHaveAttribute('lang', language.code);
    for (const theme of ['light', 'dark'] as const) {
      await page.getByRole('button', { name: language[theme], exact: true }).click();
      for (const mode of ['carousel', 'comparison'] as const) {
        await page.getByRole('button', { name: language[mode], exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
        const anonymous = await page.getByRole('button').evaluateAll((buttons) => buttons.filter((button) =>
          !button.getAttribute('aria-label')?.trim() && !button.textContent?.trim()).length);
        expect(anonymous).toBe(0);
        await testInfo.attach(`${language.code}-${theme}-${mode}-narrow`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      }
    }
  }
  await page.getByRole('button', { name: 'Carrusel', exact: true }).click();
  await center(page).focus(); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe('solid');
});
