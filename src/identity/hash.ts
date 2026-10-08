/** SHA-256 covers all original bytes, including metadata; names never participate. */
export async function hashOriginal(original: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await original.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
