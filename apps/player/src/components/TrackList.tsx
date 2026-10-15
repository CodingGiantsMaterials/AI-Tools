import { useRef } from 'react';
import { Icon } from '@ai-tools/shared/icon';
import { rowCount } from '../domain/library';
import type { LibraryState } from '../library/library-controller';
import type { Messages } from '../i18n';
import styles from './TrackList.module.css';

interface TrackListProps {
  state: LibraryState;
  currentId: string | null;
  m: Messages;
  onAdd: (index: number, file: File) => void;
  onRemove: (index: number) => void;
  onSelect: (trackId: string) => void;
}

/** Six visible rows with internal scrolling; deleting and selecting are separate controls, never nested. */
export function TrackList({ state, currentId, m, onAdd, onRemove, onSelect }: TrackListProps) {
  const ready = state.phase === 'ready';
  return <section className={styles.tracks} aria-label={m.tracks}>
    <ol className={styles.list}>
      {Array.from({ length: rowCount(state.slots) }, (_, index) => {
        const id = state.slots[index] ?? null;
        const track = id ? state.tracks[id] : undefined;
        const pending = state.pending[index];
        const current = track !== undefined && track.id === currentId;
        return <li key={index} className={current ? `${styles.row} ${styles.current}` : styles.row}>
          {track ? <>
            <button className={styles.action} aria-label={m.removeTrack(track.name)} title={m.removeTrack(track.name)}
              disabled={!ready || pending !== undefined} onClick={() => onRemove(index)}><Icon name="close" /></button>
            <button className={styles.select} aria-current={current ? 'true' : undefined} title={track.name}
              disabled={!ready || pending !== undefined} onClick={() => onSelect(track.id)}>
              <span className={styles.name}>{track.name}</span>
              {pending === 'deleting' && <span className={styles.pending}>{m.removing}</span>}
            </button>
          </> : <EmptyRow index={index} disabled={!ready || pending !== undefined} adding={pending === 'adding'} m={m} onAdd={onAdd} />}
        </li>;
      })}
    </ol>
  </section>;
}

function EmptyRow({ index, disabled, adding, m, onAdd }: { index: number; disabled: boolean; adding: boolean; m: Messages; onAdd: TrackListProps['onAdd'] }) {
  const input = useRef<HTMLInputElement>(null);
  return <>
    <button className={styles.action} aria-label={m.addTrack(index + 1)} title={m.addTrack(index + 1)} disabled={disabled}
      onClick={() => input.current?.click()}><Icon name="plus" /></button>
    <span className={styles.label}>{m.track(index + 1)}</span>
    {adding && <span className={styles.pending}>{m.adding}</span>}
    <input ref={input} type="file" accept=".mp3,audio/mpeg" hidden aria-label={m.addTrack(index + 1)}
      onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onAdd(index, file); }} />
  </>;
}
