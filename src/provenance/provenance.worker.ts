import init, { WasmReader, WASM_SRI } from '@contentauth/c2pa-wasm';
import wasmSrc from '@contentauth/c2pa-wasm/c2pa.wasm?url';
import { localReadContext, normalizeManifest, provenanceError, type Provenance } from './provenance';
import type { ImageFormat } from '../images/original';

globalThis.onmessage = async (event: MessageEvent<{ file: File; format: ImageFormat }>) => {
  let reader: WasmReader | undefined;
  let result: Provenance;
  try {
    await init({ module_or_path: fetch(wasmSrc, { integrity: WASM_SRI }) });
    reader = await WasmReader.fromBlob(event.data.format, event.data.file, await localReadContext.toJson());
    result = normalizeManifest(reader.activeManifest());
  } catch (error) {
    result = provenanceError(error);
    if (reader) { result.detection = 'present'; result.completeness = 'partial'; }
  } finally { reader?.free(); }
  globalThis.postMessage(result);
};
