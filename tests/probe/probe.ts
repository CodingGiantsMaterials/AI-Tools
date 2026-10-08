import { Reader, createC2pa } from '@contentauth/c2pa-web';
import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';
import workerSrc from '@contentauth/c2pa-web/c2pa_worker?url';
import { IdentityService } from '../../src/identity/identity-service';
import { localReadContext, ProvenanceService } from '../../src/provenance/provenance-service';
import { OriginalUrls } from '../../src/images/original';
import { directorySource, snapshotSource, pickDirectory } from '../../src/files/folder-source';

const identity = new IdentityService();
const provenance = new ProvenanceService();
const urls = new OriginalUrls();
const key = { folderGeneration: 1, entryId: 'entry', revision: 1, requestId: 1 };
const file = () => document.querySelector<HTMLInputElement>('#file')!.files![0]!;
const probe = {
  networkControl() {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./network.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event) => { worker.terminate(); resolve(event.data); };
      worker.onerror = () => { worker.terminate(); reject(new Error('NetworkObserverControl')); };
      worker.postMessage(new URL('privacy-observer-control', location.href).href);
    });
  },
  async hash() { return identity.hash(file(), key); },
  async provenance() { return provenance.read(file(), key); },
  async raw() {
    const sdk = await createC2pa({ wasmSrc, workerSrc: new URL(workerSrc, location.href) });
    let reader: Reader | null = null;
    try {
      reader = await Reader.fromBlob(sdk, undefined, file(), localReadContext);
      return reader ? { manifest: await reader.activeManifest(), store: await reader.manifestStore() } : { absent: true };
    } catch (error) { return { error: String(error) }; }
    finally { try { await reader?.free(); } finally { sdk.dispose(); } }
  },
  original() {
    const lease = urls.acquire('original', file());
    document.querySelector<HTMLImageElement>('#original')!.src = lease.url;
    return lease.url;
  },
  async settings() { return JSON.parse(await localReadContext.toJson()) as unknown; },
  directorySource, snapshotSource, pickDirectory,
  dispose() { identity.dispose(); provenance.dispose(); urls.dispose(); },
};

declare global { interface Window { probe: typeof probe } }
window.probe = probe;
