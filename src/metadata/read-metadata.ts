import ExifReader from 'exifreader';
import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom';
import { imageFormat, type ImageFormat } from '../images/original';
import { emptyMetadata, normalizeMetadata, type Metadata } from './metadata';

export const metadataLimits = { file: 64 * 1024 * 1024, block: 2 * 1024 * 1024, total: 8 * 1024 * 1024, blocks: 128 };
class LimitError extends Error {}

function checkPngTextHeader(type: string, data: Uint8Array): void {
  const keywordEnd = data.indexOf(0);
  if (keywordEnd < 1 || keywordEnd > 79) throw new Error('InvalidTextHeader');
  if (type === 'tEXt') return; // Empty text is valid after the required separator.
  if (keywordEnd + (type === 'iTXt' ? 2 : 1) >= data.length) throw new Error('InvalidTextHeader');
  if (type === 'iTXt') {
    if (data[keywordEnd + 1]! > 1 || data[keywordEnd + 2] !== 0) throw new Error('UnknownCompression');
    const languageEnd = data.indexOf(0, keywordEnd + 3);
    if (languageEnd < 0 || data.indexOf(0, languageEnd + 1) < 0) throw new Error('InvalidTextHeader');
  } else if (data[keywordEnd + 1] !== 0) throw new Error('UnknownCompression');
}

function checkTiff(view: DataView): void {
  if (view.byteLength < 8) throw new Error('TruncatedExif');
  const marker = view.getUint16(0);
  const little = marker === 0x4949;
  if ((!little && marker !== 0x4d4d) || view.getUint16(2, little) !== 42) throw new Error('InvalidExif');
  const sizes = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8, 4];
  const pending = [view.getUint32(4, little)];
  const visited = new Set<number>();
  while (pending.length) {
    const offset = pending.pop()!;
    if (!offset) continue;
    if (visited.has(offset) || offset + 2 > view.byteLength) throw new Error('InvalidExifDirectory');
    visited.add(offset);
    const count = view.getUint16(offset, little);
    if (visited.size > 32 || count > 1024) throw new LimitError();
    if (offset + 2 + 12 * count + 4 > view.byteLength) throw new Error('TruncatedExifDirectory');
    for (let i = 0; i < count; i++) {
      const tag = offset + 2 + i * 12;
      const id = view.getUint16(tag, little);
      const type = view.getUint16(tag + 2, little);
      const size = sizes[type];
      if (!size) continue; // Unknown TIFF field types are not dereferenced.
      const length = view.getUint32(tag + 4, little) * size;
      const data = length > 4 ? view.getUint32(tag + 8, little) : tag + 8;
      if (data + length > view.byteLength) throw new Error('TruncatedExifValue');
      if ([0x8769, 0x8825, 0xa005].includes(id) && type === 4 && length === 4) pending.push(view.getUint32(data, little));
    }
    pending.push(view.getUint32(offset + 2 + 12 * count, little));
  }
}

/** Bound structural metadata before the general parser allocates tag objects. */
function checkBlocks(buffer: ArrayBuffer, format: ImageFormat): { icc: boolean } {
  const view = new DataView(buffer);
  let icc = false;
  let total = 0;
  let blocks = 0;
  const check = (start: number, length: number) => {
    if (start + length > view.byteLength) throw new Error('TruncatedMetadata');
    total += length;
    if (length > metadataLimits.block || total > metadataLimits.total || ++blocks > metadataLimits.blocks) throw new LimitError();
  };
  if (format === 'image/png' || format === 'image/webp') {
    const png = format === 'image/png';
    for (let offset = png ? 8 : 12; offset < view.byteLength;) {
      if (offset + 8 > view.byteLength) throw new Error('TruncatedChunk');
      const length = view.getUint32(offset + (png ? 0 : 4), !png);
      const type = String.fromCharCode(...new Uint8Array(buffer, offset + (png ? 4 : 0), 4));
      const end = offset + 8 + length + (png ? 4 : length % 2);
      if (end > view.byteLength) throw new Error('TruncatedChunk');
      if ((png ? ['eXIf', 'iCCP', 'tEXt', 'zTXt', 'iTXt'] : ['EXIF', 'XMP ', 'ICCP']).includes(type)) check(offset + 8, length);
      if (type === 'iCCP' || type === 'ICCP') icc = true;
      if (['tEXt', 'zTXt', 'iCCP', 'iTXt'].includes(type)) checkPngTextHeader(type, new Uint8Array(buffer, offset + 8, length));
      if (type === 'eXIf' || type === 'EXIF') {
        const start = offset + 8;
        const prefix = length >= 6 && String.fromCharCode(...new Uint8Array(buffer, start, 6)) === 'Exif\0\0' ? 6 : 0;
        checkTiff(new DataView(buffer, start + prefix, length - prefix));
      }
      offset = end;
    }
  } else {
    for (let offset = 2; offset < view.byteLength;) {
      if (view.getUint8(offset++) !== 0xff) throw new Error('InvalidJpegMarker');
      while (offset < view.byteLength && view.getUint8(offset) === 0xff) offset++;
      const marker = view.getUint8(offset++);
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > view.byteLength) throw new Error('TruncatedJpeg');
      if (marker >= 0xe0 && marker <= 0xef || marker === 0xfe) check(offset, length);
      if (marker === 0xe1 && length >= 8 && String.fromCharCode(...new Uint8Array(buffer, offset + 2, 6)) === 'Exif\0\0') {
        checkTiff(new DataView(buffer, offset + 8, length - 8));
      }
      if (marker === 0xe2 && length >= 14 && String.fromCharCode(...new Uint8Array(buffer, offset + 2, 12)) === 'ICC_PROFILE\0') icc = true;
      offset += length;
    }
  }
  return { icc };
}

/** Called only inside the owned worker in production. Never accepts a URL. */
export async function readMetadata(file: File): Promise<Metadata> {
  let format: ImageFormat | null = null;
  try {
    format = await imageFormat(file);
    if (!format) return emptyMetadata(file, null, 'unsupported', 'format');
    if (file.size > metadataLimits.file) throw new LimitError();
    const buffer = await file.arrayBuffer();
    const present = checkBlocks(buffer, format);
    let failed = false;
    let exceeded = false;
    let total = 0;
    // Some ExifReader paths suppress XML/decompression errors. Track them here.
    const parser = new DOMParser({ onError: onErrorStopParsing });
    const domParser = { parseFromString(xml: string) {
      try {
        if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XmlDeclarationUnsupported');
        const document = parser.parseFromString(xml, 'application/xml');
        if (!document.getElementsByTagNameNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'RDF').length) throw new Error('InvalidXmp');
        return document;
      } catch (error) { failed = true; throw error; }
    } };
    const deflate = async (compressed: Uint8Array): Promise<Uint8Array<ArrayBuffer>> => {
      let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> | undefined;
      try {
        reader = new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength; total += value.byteLength;
          if (size > metadataLimits.block || total > metadataLimits.total) { exceeded = true; throw new LimitError(); }
          chunks.push(value);
        }
        const result = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
        return result;
      } catch (error) { failed = true; throw error; }
      finally { await reader?.cancel().catch(() => undefined); }
    };
    const tags = await ExifReader.load(buffer, { expanded: true, async: true, domParser,
      includeTags: { file: true, png: true, riff: true, icc: true,
        exif: ['DateTimeOriginal', 'SubSecTimeOriginal', 'OffsetTimeOriginal', 'Orientation', 'ColorSpace', 'Software'],
        xmp: ['DateTimeOriginal', 'DateCreated', 'CreatorTool', 'ICCProfile', 'AIGenerator', 'DigitalSourceType', 'AIModel', 'History'] },
      decompress: { deflate, maxDecompressedSize: metadataLimits.total } });
    if (exceeded) throw new LimitError();
    if (failed) throw new Error('MetadataReadFailed');
    if (present.icc && !Object.keys(tags.icc ?? {}).length) throw new Error('InvalidIcc');
    return normalizeMetadata(tags, file, format);
  } catch (error) {
    return emptyMetadata(file, format, error instanceof LimitError ? 'unsupported' : 'error', error instanceof LimitError ? 'limit' : 'read');
  }
}
