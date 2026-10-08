const paths = {
  left: 'm14 6-6 6 6 6', right: 'm10 6 6 6-6 6', down: 'm6 9 6 6 6-6', close: 'm6 6 12 12M18 6 6 18',
  copy: 'M9 7V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3M5 7h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z',
  folder: 'M3 7V5a1 1 0 0 1 1-1h5l3 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z',
  refresh: 'M20 11a8 8 0 1 0-2 6M20 4v7h-7',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20 14a8 8 0 0 1-10-10A8 8 0 1 0 20 14Z',
  image: 'M4 4h16v16H4ZM4 16l5-5 4 4 3-3 4 4M16 8h.01',
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
