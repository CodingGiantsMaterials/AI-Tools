export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

/** Signature detection is only a candidate check; native decoding can still fail. */
export async function imageFormat(file: Blob): Promise<ImageFormat | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return 'image/png';
  const ascii = String.fromCharCode(...bytes);
  if (ascii.startsWith('RIFF') && ascii.slice(8) === 'WEBP') return 'image/webp';
  return null;
}
