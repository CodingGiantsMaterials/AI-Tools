export interface CaptureDate {
  source: 'exif' | 'xmp';
  original: string;
  /** Whole UTC seconds; offset-free components use a nominal UTC convention. */
  seconds: number;
  fraction: string;
  offset: string | null;
}

export function captureDate(value: string | null, source: CaptureDate['source'], subsecond?: string | null, offset?: string | null): CaptureDate | null {
  if (!value || value.length > 128) return null;
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,32}))?(Z|[+-]\d{2}:\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s, fraction, embeddedOffset] = match;
  const parts = [y, mo, d, h, mi, s].map(Number);
  const [year, month, day, hour, minute, second] = parts as [number, number, number, number, number, number];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const zone = embeddedOffset ?? offset?.trim() ?? null;
  let offsetMinutes = 0;
  if (zone !== null && zone !== 'Z') {
    const zoneMatch = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
    if (!zoneMatch) return null;
    const hours = Number(zoneMatch[2]);
    const minutes = Number(zoneMatch[3]);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
    offsetMinutes = (hours * 60 + minutes) * (zoneMatch[1] === '-' ? -1 : 1);
  }
  const digits = fraction ?? subsecond?.trim() ?? '';
  if (digits && !/^\d{1,32}$/.test(digits)) return null;
  return { source, original: value.trim(), seconds: date.getTime() / 1000 - offsetMinutes * 60,
    fraction: digits.replace(/0+$/, ''), offset: zone };
}

const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function compareEntries(a: { name: string; entryId: string; date: CaptureDate | null }, b: { name: string; entryId: string; date: CaptureDate | null }): number {
  if (a.date && b.date) {
    const seconds = a.date.seconds - b.date.seconds;
    if (seconds) return seconds;
    const length = Math.max(a.date.fraction.length, b.date.fraction.length);
    const fraction = compareText(a.date.fraction.padEnd(length, '0'), b.date.fraction.padEnd(length, '0'));
    if (fraction) return fraction;
  } else if (a.date || b.date) return a.date ? -1 : 1;
  return compareText(a.name, b.name) || compareText(a.entryId, b.entryId);
}
