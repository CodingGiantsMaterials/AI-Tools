/**
 * Signature check only, independent of the file name and MIME type: an ID3v2 tag or an MPEG audio
 * Layer III frame header at the start. Decoding can still fail during playback.
 */
export async function isMp3(file: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  return id3v2Header(bytes) || layer3FrameHeader(bytes);
}

function id3v2Header(bytes: Uint8Array): boolean {
  const [i = 0, d = 0, three = 0, major = 0, revision = 0] = bytes;
  // "ID3", major version 2–4, revision below 0xFF and a four-byte syncsafe size (each byte below 0x80).
  return bytes.length === 10 && i === 0x49 && d === 0x44 && three === 0x33 && major >= 2 && major <= 4 && revision < 0xff
    && bytes.subarray(6).every((byte) => byte < 0x80);
}

function layer3FrameHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const [first = 0, second = 0, third = 0] = bytes;
  return first === 0xff && (second & 0xe0) === 0xe0 // 11-bit frame sync
    && (second & 0x18) !== 0x08 // MPEG version is not reserved
    && (second & 0x06) === 0x02 // Layer III
    && (third & 0xf0) !== 0xf0 // bitrate index is not invalid
    && (third & 0x0c) !== 0x0c; // sampling rate is not reserved
}
