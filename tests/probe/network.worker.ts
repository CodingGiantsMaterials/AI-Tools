globalThis.onmessage = async (event: MessageEvent<string>) => {
  try { await fetch(event.data); globalThis.postMessage('observed'); }
  catch { globalThis.postMessage('failed'); }
};
