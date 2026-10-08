import { describe, expect, it, vi } from 'vitest';
import { directorySource, snapshotSource, type ReadOnlyDirectoryHandle } from '../../src/files/folder-source';

function relativeFile(path: string) {
  const file = new File(['original'], path.split('/').at(-1)!);
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}

describe('read-only folder boundaries', () => {
  it('keeps direct children only in a webkitdirectory snapshot', async () => {
    const source = snapshotSource([relativeFile('root/one.png'), relativeFile('root/sub/two.png'), relativeFile('loose.png')]);
    const entries = await source.list();
    expect(entries.map((entry) => entry.name)).toEqual(['one.png']);
    expect(source.canRefresh).toBe(false);
    expect(await entries[0]!.getFile()).toBe(await entries[0]!.getFile());
  });

  it('does not traverse directories and reacquires the current file from its handle', async () => {
    let current = new File(['first'], 'one.png');
    const permission = vi.fn(async () => 'granted' as const);
    const handle: ReadOnlyDirectoryHandle = {
      kind: 'directory', queryPermission: permission,
      async *values() {
        yield { kind: 'file', name: 'one.png', getFile: async () => current };
        yield { kind: 'directory', name: 'sub' };
      },
    };
    const entries = await directorySource(handle).list();
    expect(entries).toHaveLength(1);
    expect(await (await entries[0]!.getFile()).text()).toBe('first');
    current = new File(['other'], 'one.png');
    expect(await (await entries[0]!.getFile()).text()).toBe('other');
    expect(permission).toHaveBeenCalledWith({ mode: 'read' });
  });

  it('reports lost permission and file removal without requesting new permissions', async () => {
    const source = directorySource({ kind: 'directory', queryPermission: async () => 'denied', async *values() { throw new Error('Must not enumerate'); } });
    await expect(source.list()).rejects.toMatchObject({ name: 'NotAllowedError' });
    const deleted = directorySource({ kind: 'directory', queryPermission: async () => 'granted', async *values() {
      yield { kind: 'file', name: 'removed.png', getFile: async () => { throw new DOMException('Gone', 'NotFoundError'); } };
    } });
    await expect((await deleted.list())[0]!.getFile()).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
