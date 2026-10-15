/** Reads localStorage key `<prefix>-<key>`; null when the key is absent or storage is unavailable. */
export function storedPreference(prefix: string, key: string): string | null {
  try { return localStorage.getItem(`${prefix}-${key}`); } catch { return null; }
}

/** Writes localStorage key `<prefix>-<key>`; without storage, the caller's state keeps the value in memory. */
export function savePreference(prefix: string, key: string, value: string): void {
  try { localStorage.setItem(`${prefix}-${key}`, value); } catch { /* Preferences remain usable in memory. */ }
}
