import { SerialQueue, type WorkKey, type WorkResult } from '../core/work';
import { emptyMetadata, type Metadata } from './metadata';

export class MetadataService {
  private queue = new SerialQueue();
  private cancelActive: (() => void) | undefined;

  read(file: File, key: WorkKey, priority = 0, signal?: AbortSignal): Promise<WorkResult<Metadata>> {
    return this.queue.submit(() => new Promise<WorkResult<Metadata>>((resolve, reject) => {
      let worker: Worker | undefined;
      let stopped = false;
      const finish = (value?: Metadata, aborted = false) => {
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        worker?.terminate();
        this.cancelActive = undefined;
        if (aborted) reject(new DOMException('Cancelled', 'AbortError'));
        else resolve({ key, value: value! });
      };
      const abort = () => finish(undefined, true);
      const timer = setTimeout(() => finish(emptyMetadata(file, null, 'error', 'timeout')), 10_000);
      this.cancelActive = abort;
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      try {
        worker = new Worker(new URL('./metadata.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<Metadata>) => finish(event.data);
        worker.onerror = worker.onmessageerror = () => finish(emptyMetadata(file, null, 'error', 'read'));
        worker.postMessage(file);
      } catch { finish(emptyMetadata(file, null, 'error', 'read')); }
    }), priority, signal);
  }

  dispose(): void { this.queue.dispose(); this.cancelActive?.(); }
}
