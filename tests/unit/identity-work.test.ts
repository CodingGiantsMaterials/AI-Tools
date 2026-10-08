import { describe, expect, it } from 'vitest';
import { hashOriginal } from '../../src/identity/hash';
import { sameWork, SerialQueue, type WorkKey } from '../../src/core/work';

describe('identity and background work', () => {
  it('hashes all bytes, shares identity across renames and distinguishes same-metadata replacements', async () => {
    const a = new File(['abc'], 'same.jpg', { lastModified: 1 });
    const b = new File(['abd'], 'same.jpg', { lastModified: 1 });
    expect(a.size).toBe(b.size);
    expect(await hashOriginal(a)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await hashOriginal(new File([a], 'renamed.jpg'))).toBe(await hashOriginal(a));
    expect(await hashOriginal(b)).not.toBe(await hashOriginal(a));
  });

  it('rejects stale folder, entry, revision and request results independently', () => {
    const key: WorkKey = { folderGeneration: 1, entryId: 'one', revision: 2, requestId: 3 };
    expect(sameWork(key, { ...key })).toBe(true);
    for (const change of [{ folderGeneration: 2 }, { entryId: 'two' }, { revision: 3 }, { requestId: 4 }]) {
      expect(sameWork(key, { ...key, ...change })).toBe(false);
    }
  });

  it('bounds pending work, prioritizes active-image tasks and never overlaps execution', async () => {
    const queue = new SerialQueue(2);
    const order: string[] = [];
    let release!: () => void;
    const first = queue.submit(() => new Promise<void>((resolve) => { release = resolve; order.push('first'); }));
    const low = queue.submit(async () => { order.push('low'); }, 0);
    const high = queue.submit(async () => { order.push('high'); }, 1);
    await expect(queue.submit(async () => 'overflow')).rejects.toThrow('QueueFull');
    expect(order).toEqual(['first']);
    release();
    await Promise.all([first, low, high]);
    expect(order).toEqual(['first', 'high', 'low']);
    queue.dispose();
  });

  it('drops cancelled queued work and prevents submissions after disposal', async () => {
    const queue = new SerialQueue();
    let release!: () => void;
    const active = queue.submit(() => new Promise<void>((resolve) => { release = resolve; }));
    const abort = new AbortController();
    const queued = queue.submit(async () => { throw new Error('Must not run'); }, 0, abort.signal);
    const assertion = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    abort.abort(); await assertion;
    queue.dispose(); release(); await active;
    await expect(queue.submit(async () => 'no')).rejects.toMatchObject({ name: 'AbortError' });
  });
});
