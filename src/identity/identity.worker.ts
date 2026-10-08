import { hashOriginal } from './hash';

globalThis.onmessage = async (event: MessageEvent<Blob>) => {
  try { globalThis.postMessage({ value: await hashOriginal(event.data) }); }
  catch { globalThis.postMessage({ error: 'HashReadError' }); }
};
