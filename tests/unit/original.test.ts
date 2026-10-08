import { afterEach, expect, it, vi } from 'vitest';
import { imageFormat, OriginalUrls } from '../../src/images/original';
import { readFile } from 'node:fs/promises';

afterEach(() => vi.restoreAllMocks());

it('detects actual image signatures despite wrong names and MIME labels', async () => {
  const bytes = await readFile('tests/fixtures/images/animated.webp');
  expect(await imageFormat(new File([bytes], 'wrong.jpg', { type: 'image/jpeg' }))).toBe('image/webp');
  expect(await imageFormat(new File(['not an image'], 'looks-valid.png', { type: 'image/png' }))).toBeNull();
});

it('shares original URLs per revision and revokes only after the last consumer', () => {
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:original');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const urls = new OriginalUrls();
  const file = new File(['original'], 'animated.png');
  const a = urls.acquire('generation:entry:revision', file);
  const b = urls.acquire('generation:entry:revision', file);
  expect(a.url).toBe(b.url);
  expect(create).toHaveBeenCalledExactlyOnceWith(file);
  a.release(); a.release();
  expect(revoke).not.toHaveBeenCalled();
  b.release();
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:original');
  urls.dispose();
  expect(() => urls.acquire('later', file)).toThrow('ImageResourcesDisposed');
});
