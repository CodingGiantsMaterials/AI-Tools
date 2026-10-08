import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Byte-processing probes use browser Files independent of path-upload support. */
export async function fixtureFile(relativePath: string) {
  const name = path.basename(relativePath);
  const mimeType = name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.png') ? 'image/png' : 'image/webp';
  return { name, mimeType, buffer: await readFile(path.resolve('tests/fixtures', relativePath)) };
}
