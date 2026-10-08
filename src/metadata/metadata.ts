import type { ImageFormat } from '../images/original';
import { captureDate, type CaptureDate } from './date';

export interface Metadata {
  status: 'ready' | 'error' | 'unsupported';
  reason: 'read' | 'limit' | 'timeout' | 'format' | null;
  format: ImageFormat | null;
  name: string;
  size: number;
  width: number | null;
  height: number | null;
  megapixels: number | null;
  orientation: number | null;
  date: CaptureDate | null;
  colorProfile: string | null;
  colorSpace: string | null;
  software: string[];
  generators: string[];
  aiDeclarations: string[];
  recordedHistory: string[];
}

export const plainText = (value: unknown): string | null => typeof value === 'string'
  ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, 2048) : null;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function tagValue(group: unknown, name: string): unknown { return record(record(group)[name]).value; }
function stringTag(group: unknown, name: string): string | null {
  const value = tagValue(group, name);
  return plainText(Array.isArray(value) ? value[0] : value);
}
const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => !!value))].slice(0, 32);
const dimension = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1_000_000 ? value : null;

export function emptyMetadata(file: Pick<File, 'name' | 'size'>, format: ImageFormat | null, status: Metadata['status'], reason: Metadata['reason']): Metadata {
  return { status, reason, format, name: plainText(file.name) ?? '', size: file.size, width: null, height: null,
    megapixels: null, orientation: null, date: null, colorProfile: null, colorSpace: null, software: [], generators: [], aiDeclarations: [], recordedHistory: [] };
}

/** A narrow allowlist. Text remains untrusted and must be rendered as text. */
export function normalizeMetadata(tags: unknown, file: Pick<File, 'name' | 'size'>, format: ImageFormat): Metadata {
  const groups = record(tags);
  const { exif, xmp, png, pngFile, pngText, icc, riff } = groups;
  const width = dimension(tagValue(groups.file, 'Image Width')) ?? dimension(tagValue(pngFile, 'Image Width')) ?? dimension(tagValue(png, 'Image Width')) ?? dimension(tagValue(riff, 'ImageWidth'));
  const height = dimension(tagValue(groups.file, 'Image Height')) ?? dimension(tagValue(pngFile, 'Image Height')) ?? dimension(tagValue(png, 'Image Height')) ?? dimension(tagValue(riff, 'ImageHeight'));
  const date = captureDate(stringTag(exif, 'DateTimeOriginal'), 'exif', stringTag(exif, 'SubSecTimeOriginal'), stringTag(exif, 'OffsetTimeOriginal'))
    ?? captureDate(stringTag(xmp, 'DateTimeOriginal'), 'xmp') ?? captureDate(stringTag(xmp, 'DateCreated'), 'xmp');
  const orientation = tagValue(exif, 'Orientation');
  const profile = tagValue(icc, 'ICC Description');
  const profileText = plainText(profile) ?? (Object.values(record(profile)).slice(0, 8).map(plainText).filter(Boolean).join(' / ') || null);
  const colorSpace = tagValue(exif, 'ColorSpace');
  const history = tagValue(xmp, 'History');
  const recordedHistory = Array.isArray(history) ? history.slice(0, 32).flatMap((item) => {
    return unique([stringTag(item, 'action'), stringTag(item, 'softwareAgent'), stringTag(item, 'when')]);
  }).slice(0, 32) : [];
  return { ...emptyMetadata(file, format, 'ready', null), width, height, megapixels: width && height ? width * height / 1_000_000 : null,
    orientation: typeof orientation === 'number' && orientation >= 1 && orientation <= 8 ? orientation : null, date,
    colorProfile: plainText(profileText) ?? stringTag(xmp, 'ICCProfile'),
    colorSpace: stringTag(icc, 'Color Space') ?? (colorSpace === 1 ? 'sRGB' : colorSpace === 65535 ? 'Uncalibrated' : null),
    software: unique([stringTag(exif, 'Software'), stringTag(xmp, 'CreatorTool'), stringTag(pngText, 'Software'), stringTag(png, 'Software')]),
    generators: unique([stringTag(xmp, 'AIGenerator'), stringTag(pngText, 'Generator'), stringTag(png, 'Generator')]),
    aiDeclarations: unique([stringTag(xmp, 'DigitalSourceType'), stringTag(xmp, 'AIModel'), stringTag(pngText, 'parameters'), stringTag(pngText, 'prompt')]),
    recordedHistory };
}
