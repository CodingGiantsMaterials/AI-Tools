import { readMetadata } from './read-metadata';

self.onmessage = async (event: MessageEvent<File>) => {
  self.postMessage(await readMetadata(event.data));
};
