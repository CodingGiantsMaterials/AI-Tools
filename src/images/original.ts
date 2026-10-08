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

/** Own one lease per mounted consumer, outside render; release on revision change. */
export class OriginalUrls {
  private entries = new Map<string, { url: string; users: number }>();
  private disposed = false;

  acquire(revisionKey: string, original: File): { url: string; release: () => void } {
    if (this.disposed) throw new Error('ImageResourcesDisposed');
    let entry = this.entries.get(revisionKey);
    if (!entry) {
      entry = { url: URL.createObjectURL(original), users: 0 };
      this.entries.set(revisionKey, entry);
    }
    entry.users++;
    let released = false;
    return { url: entry.url, release: () => {
      if (released) return;
      released = true;
      if (--entry.users === 0 && !this.disposed) {
        URL.revokeObjectURL(entry.url);
        this.entries.delete(revisionKey);
      }
    } };
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.entries.values()) URL.revokeObjectURL(entry.url);
    this.entries.clear();
  }
}
