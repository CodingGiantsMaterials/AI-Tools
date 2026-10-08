import { Context, Reader, createC2pa, type C2pa } from '@contentauth/c2pa-web';
import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';
import workerSrc from '@contentauth/c2pa-web/c2pa_worker?url';
import { SerialQueue, type WorkKey, type WorkResult } from '../core/work';
import { imageFormat } from '../images/original';

/** Passed to every Reader, not merely to the runtime factory. No URL trust inputs. */
export const localReadContext = new Context({
  verify: {
    verifyAfterReading: false, verifyTrust: false, verifyTimestampTrust: false,
    remoteManifestFetch: false, ocspFetch: false,
  },
  trust: { verifyTrustList: false, trustAnchors: [], userAnchors: [], allowedList: [] },
  cawgTrust: { verifyTrustList: false, trustAnchors: [], userAnchors: [], allowedList: [] },
});

export interface Provenance {
  status: 'detected' | 'none' | 'remote' | 'unsupported' | 'error';
  detection: 'present' | 'absent' | 'external' | 'unknown';
  completeness: 'complete' | 'partial' | 'not-read';
  claimGenerator: string | null;
  actions: string[];
}

const empty = (status: Provenance['status']): Provenance => ({
  status, detection: status === 'none' ? 'absent' : status === 'remote' ? 'external' : 'unknown',
  completeness: 'not-read', claimGenerator: null, actions: [],
});
const text = (value: unknown): string | null => typeof value === 'string' ? value.slice(0, 2048) : null;

export function provenanceError(error: unknown): Provenance {
  const message = error instanceof Error ? error.message : '';
  // These SDK error categories must remain distinct from JumbfNotFound (null).
  if (/RemoteManifest|RemoteManifestUrl/.test(message)) return empty('remote');
  if (/UnsupportedType|UnsupportedAlgorithm|UnknownAlgorithm|UnsupportedVersion/.test(message)) return empty('unsupported');
  return empty('error');
}

/** Serial SDK reads; each reader is freed and its worker terminated after the read. */
export class ProvenanceService {
  private queue = new SerialQueue();
  private cancelActive: (() => void) | undefined;

  read(file: File, key: WorkKey, priority = 0, signal?: AbortSignal): Promise<WorkResult<Provenance>> {
    return this.queue.submit(async () => {
      if (file.size > 64 * 1024 * 1024) return { key, value: empty('unsupported') };
      const format = await imageFormat(file);
      if (!format) return { key, value: empty('unsupported') };
      const resources: { runtime?: C2pa; reader?: Reader | null } = {};

      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      const operation = async (): Promise<Provenance> => {
        resources.runtime = await createC2pa({ wasmSrc, workerSrc: new URL(workerSrc, location.href) });
        if (stopped) { resources.runtime.dispose(); throw new DOMException('Cancelled', 'AbortError'); }
        resources.reader = await Reader.fromBlob(resources.runtime, format, file, localReadContext);
        if (!resources.reader) return empty('none');
        const manifest = await resources.reader.activeManifest();
        if (!manifest) return { ...empty('error'), detection: 'present', completeness: 'partial' };
        const actions: string[] = [];
        const assertions = manifest.assertions ?? [];
        let partial = assertions.length > 128;
        for (const assertion of assertions.slice(0, 128)) {
          if (assertion.label === 'c2pa.actions' || assertion.label.startsWith('c2pa.actions.')) {
            const data = assertion.data as { actions?: { action?: unknown }[] } | undefined;
            const recordedActions = Array.isArray(data?.actions) ? data.actions : [];
            partial ||= recordedActions.length > 64;
            for (const action of recordedActions.slice(0, 64)) {
              const label = text(action.action);
              if (label) actions.push(label);
            }
          }
        }
        return { status: 'detected', detection: 'present', completeness: partial || actions.length > 64 ? 'partial' : 'complete',
          claimGenerator: text(manifest.claim_generator), actions: actions.slice(0, 64) };
      };
      try {
        const value = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => {
            abort = () => { stopped = true; resources.runtime?.dispose(); reject(new DOMException('Cancelled', 'AbortError')); };
            this.cancelActive = abort;
            signal?.addEventListener('abort', abort, { once: true });
            if (signal?.aborted) abort();
            timer = setTimeout(() => {
              stopped = true; resources.runtime?.dispose(); reject(new Error('ProvenanceTimeout'));
            }, 20_000);
          }),
        ]);
        return { key, value };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        const value = provenanceError(error);
        if (resources.reader) { value.detection = 'present'; value.completeness = 'partial'; }
        return { key, value };
      } finally {
        clearTimeout(timer);
        if (abort) signal?.removeEventListener('abort', abort);
        this.cancelActive = undefined;
        if (!stopped) {
          try { await resources.reader?.free(); } finally { resources.runtime?.dispose(); }
        }
      }
    }, priority, signal);
  }

  dispose(): void { this.queue.dispose(); this.cancelActive?.(); }
}
