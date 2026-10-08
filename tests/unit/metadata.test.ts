import { describe, expect, it } from 'vitest';
import { captureDate, compareEntries } from '../../src/metadata/date';
import { normalizeMetadata } from '../../src/metadata/metadata';
import { readMetadata, metadataLimits } from '../../src/metadata/read-metadata';
import { metadataPng, textChunk, xmpChunk, xmpPacket, pngChunk, exifChunk, iccChunk } from '../fixtures/metadata-data';

const file = (bytes: Uint8Array) => new File([new Uint8Array(bytes)], 'untrusted.jpg', { type: 'image/jpeg' });
const tag = (value: unknown) => ({ value });

describe('capture ordering', () => {
  it('normalizes offsets, preserves long fractions and uses nominal UTC for missing offsets', () => {
    const without = captureDate('2024:02:29 01:02:03', 'exif', '1234567890123');
    expect(without).toMatchObject({ seconds: Date.UTC(2024, 1, 29, 1, 2, 3) / 1000, fraction: '1234567890123', offset: null });
    expect(captureDate('2024-02-29T03:02:03.1200+02:00', 'xmp')).toMatchObject({ seconds: without!.seconds, fraction: '12', offset: '+02:00' });
    expect(captureDate('2024:02:29 03:02:03', 'exif', null, '+02:00')!.seconds).toBe(without!.seconds);
  });
  it.each(['2023:02:29 12:00:00', '2024:04:31 12:00:00', '2024:00:01 12:00:00', '2024:01:01 24:00:00', '2024-01-01T00:00:00+14:30', 'junk'])('rejects invalid components: %s', (value) => {
    expect(captureDate(value, 'exif')).toBeNull();
  });
  it('sorts missing values last and ties by code-unit name then ID independently of locale', () => {
    const date = captureDate('2024:01:01 00:00:00', 'exif');
    const entries = [
      { name: 'A', entryId: '0', date: null }, { name: 'ä', entryId: '1', date },
      { name: 'Z', entryId: '3', date }, { name: 'Z', entryId: '2', date },
      { name: 'first', entryId: '4', date: { ...date!, fraction: '00000000000001', seconds: date!.seconds - 1 } },
    ];
    expect(entries.sort(compareEntries).map((entry) => entry.entryId)).toEqual(['4', '2', '3', '1', '0']);
    expect(compareEntries({ ...entries[1]!, date: { ...date!, fraction: '1' } }, { ...entries[1]!, date: { ...date!, fraction: '10001' } })).toBeLessThan(0);
  });
  it('prefers valid EXIF then capture XMP, never modification dates', () => {
    const metadata = (exif: unknown, xmp: unknown) => normalizeMetadata({ exif, xmp }, { name: 'a', size: 1 }, 'image/jpeg');
    const xmp = { DateTimeOriginal: tag('2024-01-02T03:04:05Z'), ModifyDate: tag('2000-01-01T00:00:00Z') };
    expect(metadata({ DateTimeOriginal: tag(['2020:01:01 00:00:00']) }, xmp).date?.source).toBe('exif');
    expect(metadata({ DateTimeOriginal: tag(['invalid']) }, xmp).date?.source).toBe('xmp');
    expect(metadata({ DateTime: tag('2020:01:01 00:00:00') }, { ModifyDate: xmp.ModifyDate }).date).toBeNull();
  });
});

describe('ordinary metadata adapter', () => {
  it('reads actual EXIF components and compressed ICC without applying orientation twice', async () => {
    const result = await readMetadata(file(metadataPng(exifChunk(), iccChunk())));
    expect(result).toMatchObject({ status: 'ready', orientation: 6, width: 32, height: 32, colorProfile: 'Test RGB profile', colorSpace: 'RGB ',
      date: { source: 'exif', fraction: '123456789', offset: '+02:00', seconds: Date.UTC(2024, 1, 29, 10, 34, 56) / 1000 } });
  });
  it('reads compressed PNG software and XMP in a non-DOM worker environment', async () => {
    const bytes = metadataPng(textChunk('Software', '<script>example</script>', true), xmpChunk(xmpPacket('<exif:DateTimeOriginal>2024-05-06T12:00:00.123456+02:00</exif:DateTimeOriginal><xmp:CreatorTool>Creator</xmp:CreatorTool>')));
    const result = await readMetadata(file(bytes));
    expect(result).toMatchObject({ status: 'ready', format: 'image/png', width: 32, height: 32,
      software: ['Creator', '<script>example</script>'], date: { source: 'xmp', offset: '+02:00', fraction: '123456' } });
  });
  it('bounds displayed values and distinguishes recorded software from explicit generator tags', () => {
    const metadata = normalizeMetadata({ exif: { Software: tag(['Editor']) }, xmp: { CreatorTool: tag('Manifest tool') }, pngText: { Generator: tag('X'.repeat(5000)), prompt: tag('a photo') } }, { name: 'a', size: 1 }, 'image/png');
    expect(metadata.software).toEqual(['Editor', 'Manifest tool']);
    expect(metadata.generators[0]).toHaveLength(2048);
    expect(metadata.aiDeclarations).toEqual(['a photo']);
  });
  it('returns error for damaged metadata and rejects XML declarations without fetching them', async () => {
    expect((await readMetadata(file(metadataPng(xmpChunk('<x:xmpmeta><broken'))))).status).toBe('error');
    expect((await readMetadata(file(metadataPng(xmpChunk('<!DOCTYPE x SYSTEM "https://example.invalid/x"><x/>')))))).toMatchObject({ status: 'error', reason: 'read' });
    expect((await readMetadata(file(metadataPng(pngChunk('eXIf', Buffer.from('bad')))))).status).toBe('error');
  });
  it('caps compressed expansion and encoded metadata blocks', async () => {
    expect((await readMetadata(file(metadataPng(textChunk('Software', 'x'.repeat(metadataLimits.block + 1), true)))))).toMatchObject({ status: 'unsupported', reason: 'limit' });
    expect((await readMetadata(file(metadataPng(textChunk('Software', 'x'.repeat(metadataLimits.block + 1))))))).toMatchObject({ status: 'unsupported', reason: 'limit' });
  });
  it('distinguishes unsupported signature from parser failure', async () => {
    expect((await readMetadata(file(new Uint8Array([1, 2, 3])))).status).toBe('unsupported');
    expect((await readMetadata(file(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])))).status).toBe('error');
  });
});
