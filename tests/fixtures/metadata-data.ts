import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

export function pngChunk(type: string, data: Buffer): Buffer {
  const bytes = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, bytes, checksum]);
}

export function metadataPng(...chunks: Buffer[]): Buffer {
  const png = readFileSync('tests/fixtures/images/static.png');
  return Buffer.concat([png.subarray(0, 33), ...chunks, png.subarray(33)]);
}

export const textChunk = (key: string, text: string, compressed = false) => pngChunk(compressed ? 'zTXt' : 'tEXt',
  Buffer.concat([Buffer.from(`${key}\0${compressed ? '\0' : ''}`), compressed ? deflateSync(Buffer.from(text)) : Buffer.from(text)]));

export const xmpPacket = (body: string) => `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">${body}</rdf:Description></rdf:RDF></x:xmpmeta>`;
export const xmpChunk = (xml: string) => pngChunk('iTXt', Buffer.concat([Buffer.from('XML:com.adobe.xmp\0\0\0\0\0'), Buffer.from(xml)]));
export const xmpHistory = `<xmpMM:History xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#"><rdf:Seq><rdf:li rdf:parseType="Resource"><stEvt:action>created</stEvt:action><stEvt:softwareAgent>Editor</stEvt:softwareAgent><stEvt:when>2024-01-01T00:00:00Z</stEvt:when></rdf:li></rdf:Seq></xmpMM:History>`;

export function exifChunk(orientation = 6): Buffer {
  const values: [number, string][] = [[0x9003, '2024:02:29 12:34:56'], [0x9011, '+02:00'], [0x9291, '123456789']];
  const fields = values.length + 1;
  const tableEnd = 8 + 2 + fields * 12 + 4;
  const bytes = Buffer.alloc(tableEnd + values.reduce((sum, [, value]) => sum + value.length + 1, 0));
  bytes.write('II'); bytes.writeUInt16LE(42, 2); bytes.writeUInt32LE(8, 4); bytes.writeUInt16LE(fields, 8);
  let offset = tableEnd;
  for (const [i, [tag, value]] of values.entries()) {
    const start = 10 + i * 12; bytes.writeUInt16LE(tag, start); bytes.writeUInt16LE(2, start + 2);
    bytes.writeUInt32LE(value.length + 1, start + 4); bytes.writeUInt32LE(offset, start + 8);
    bytes.write(value, offset); offset += value.length + 1;
  }
  const start = 10 + values.length * 12;
  bytes.writeUInt16LE(0x112, start); bytes.writeUInt16LE(3, start + 2); bytes.writeUInt32LE(1, start + 4); bytes.writeUInt16LE(orientation, start + 8);
  return pngChunk('eXIf', bytes);
}

export function iccChunk(): Buffer {
  const description = Buffer.from('Test RGB profile\0');
  const bytes = Buffer.alloc(144 + 12 + description.length);
  bytes.writeUInt32BE(bytes.length); bytes.write('mntr', 12); bytes.write('RGB ', 16); bytes.write('XYZ ', 20);
  bytes.writeUInt16BE(2024, 24); bytes.writeUInt16BE(1, 26); bytes.writeUInt16BE(1, 28); bytes.write('acsp', 36);
  bytes.writeUInt32BE(1, 128); bytes.write('desc', 132); bytes.writeUInt32BE(144, 136); bytes.writeUInt32BE(12 + description.length, 140);
  bytes.write('desc', 144); bytes.writeUInt32BE(description.length, 152); description.copy(bytes, 156);
  return pngChunk('iCCP', Buffer.concat([Buffer.from('Profile\0\0'), deflateSync(bytes)]));
}
