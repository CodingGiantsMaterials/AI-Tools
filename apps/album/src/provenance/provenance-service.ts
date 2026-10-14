import { SerialQueue, type WorkKey, type WorkResult } from '../core/work';
import { imageFormat } from '@ai-tools/shared/image-format';
import { emptyProvenance, provenanceError, type Provenance } from './provenance';

/** One directly owned worker per active read, including WASM initialization. */
export class ProvenanceService {
  private queue = new SerialQueue();
  private cancelActive: (() => void) | undefined;

  read(file: File, key: WorkKey, priority = 0, signal?: AbortSignal): Promise<WorkResult<Provenance>> {
    return this.queue.submit(() => new Promise<WorkResult<Provenance>>((resolve, reject) => {
      let worker: Worker | undefined;
      let stopped = false;
      const finish = (value: Provenance | undefined, error?: DOMException) => {
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        worker?.terminate();
        this.cancelActive = undefined;
        if (error) reject(error);
        else resolve({ key, value: value! });
      };
      const abort = () => finish(undefined, new DOMException('Cancelled', 'AbortError'));
      const timer = setTimeout(() => finish(emptyProvenance('error')), 20_000);
      this.cancelActive = abort;
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }

      void (async () => {
        try {
          if (file.size > 64 * 1024 * 1024) { finish(emptyProvenance('unsupported')); return; }
          const format = await imageFormat(file);
          if (stopped) return;
          if (!format) { finish(emptyProvenance('unsupported')); return; }
          worker = new Worker(new URL('./provenance.worker.ts', import.meta.url), { type: 'module' });
          worker.onmessage = (event: MessageEvent<Provenance>) => finish(event.data);
          worker.onerror = () => finish(emptyProvenance('error'));
          worker.onmessageerror = () => finish(emptyProvenance('error'));
          worker.postMessage({ file, format });
        } catch (error) { finish(provenanceError(error)); }
      })();
    }), priority, signal);
  }

  dispose(): void { this.queue.dispose(); this.cancelActive?.(); }
}
