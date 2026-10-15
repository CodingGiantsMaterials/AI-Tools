const repeat = 'm17 3 3 3-3 3M4 11v-1a4 4 0 0 1 4-4h12M7 21l-3-3 3-3M20 13v1a4 4 0 0 1-4 4H4';
const speaker = 'M11 5 6 9H3v6h3l5 4V5Z';
const paths = {
  left: 'm14 6-6 6 6 6', right: 'm10 6 6 6-6 6', down: 'm6 9 6 6 6-6', close: 'm6 6 12 12M18 6 6 18',
  copy: 'M9 7V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3M5 7h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z',
  folder: 'M3 7V5a1 1 0 0 1 1-1h5l3 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z',
  refresh: 'M20 11a8 8 0 1 0-2 6M20 4v7h-7',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20 14a8 8 0 0 1-10-10A8 8 0 1 0 20 14Z',
  image: 'M4 4h16v16H4ZM4 16l5-5 4 4 3-3 4 4M16 8h.01',
  play: 'M8 5v14l11-7Z', pause: 'M9 5v14M15 5v14',
  next: 'M6 5v14l10-7ZM18 5v14', previous: 'M18 5v14L8 12ZM6 5v14',
  repeat, 'repeat-one': `${repeat}M11 10.5 12.5 9v6`,
  shuffle: 'M16 4h4v4M4 20 20 4M20 16v4h-4M14 14l6 6M4 4l6 6',
  volume: `${speaker}M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13`, 'volume-off': `${speaker}M16 9.5l5 5M21 9.5l-5 5`,
  plus: 'M12 5v14M5 12h14',
};
export type IconName = keyof typeof paths;
export function Icon({ name }: { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
