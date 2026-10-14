/** Own one `blob:` URL lease per mounted consumer, outside render; release on revision change. */
export class ObjectUrls {
  private entries = new Map<string, { url: string; users: number }>();
  private disposed = false;

  acquire(revisionKey: string, blob: Blob): { url: string; release: () => void } {
    if (this.disposed) throw new Error('ObjectUrlsDisposed');
    let entry = this.entries.get(revisionKey);
    if (!entry) {
      entry = { url: URL.createObjectURL(blob), users: 0 };
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
