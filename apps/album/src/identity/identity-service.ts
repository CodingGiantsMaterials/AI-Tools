import { SerialQueue, type WorkKey, type WorkResult } from '../core/work';

export class IdentityService {
  private queue = new SerialQueue();
  private cancelActive: (() => void) | undefined;

  hash(file: File, key: WorkKey, priority = 0, signal?: AbortSignal): Promise<WorkResult<string>> {
    return this.queue.submit(() => new Promise<WorkResult<string>>((resolve, reject) => {
      const worker = new Worker(new URL('./identity.worker.ts', import.meta.url), { type: 'module' });
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        worker.terminate();
        this.cancelActive = undefined;
      };
      const abort = () => { finish(); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(() => { finish(); reject(new Error('HashTimeout')); }, 30_000);
      this.cancelActive = abort;
      signal?.addEventListener('abort', abort, { once: true });
      worker.onmessage = (event: MessageEvent<{ value?: string; error?: string }>) => {
        finish();
        if (event.data.value) resolve({ key, value: event.data.value });
        else reject(new Error('HashReadError'));
      };
      worker.onerror = () => { finish(); reject(new Error('HashWorkerError')); };
      worker.postMessage(file);
    }), priority, signal);
  }

  dispose(): void { this.queue.dispose(); this.cancelActive?.(); }
}
