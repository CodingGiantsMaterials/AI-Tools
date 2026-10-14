/** A result belongs to one folder, entry, content revision and request. */
export interface WorkKey {
  readonly folderGeneration: number;
  readonly entryId: string;
  readonly revision: number;
  readonly requestId: number;
}

export function sameWork(a: WorkKey, b: WorkKey): boolean {
  return a.folderGeneration === b.folderGeneration && a.entryId === b.entryId &&
    a.revision === b.revision && a.requestId === b.requestId;
}

export interface WorkResult<T> { key: WorkKey; value: T }

type Pending = { priority: number; run: () => Promise<void>; cancel: () => void };

/** One heavy operation at a time; callers retry overflow when it becomes relevant. */
export class SerialQueue {
  private pending: Pending[] = [];
  private active = false;
  private disposed = false;

  constructor(private readonly capacity = 16) {}

  submit<T>(run: () => Promise<T>, priority = 0, signal?: AbortSignal): Promise<T> {
    if (this.disposed || signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    if (this.pending.length >= this.capacity) return Promise.reject(new Error('QueueFull'));
    return new Promise<T>((resolve, reject) => {
      const cancel = () => {
        const index = this.pending.indexOf(task);
        if (index >= 0) this.pending.splice(index, 1);
        signal?.removeEventListener('abort', cancel);
        reject(new DOMException('Cancelled', 'AbortError'));
      };
      const task: Pending = {
        priority, cancel,
        run: async () => {
          try {
            if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
            const value = await run();
            if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
            resolve(value);
          } catch (error) { reject(error); }
          finally { signal?.removeEventListener('abort', cancel); }
        },
      };
      signal?.addEventListener('abort', cancel, { once: true });
      this.pending.push(task);
      this.pending.sort((a, b) => b.priority - a.priority);
      void this.drain();
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const task of [...this.pending]) task.cancel();
  }

  private async drain(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      while (this.pending.length) await this.pending.shift()!.run();
    } finally { this.active = false; }
  }
}
