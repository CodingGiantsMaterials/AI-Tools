import { useEffect, useRef } from 'react';
import { Icon } from '@ai-tools/shared/icon';
import { isActive, maxVolume, type AudioController, type AudioState } from '../audio/audio-controller';
import type { LibraryController } from '../library/library-controller';
import type { Repeat } from '../domain/playback';
import { formatTime } from '../domain/time';
import type { Messages } from '../i18n';
import styles from './PlayerPanel.module.css';

interface PlayerPanelProps {
  state: AudioState;
  repeat: Repeat;
  shuffle: boolean;
  audio: AudioController;
  library: LibraryController;
  m: Messages;
}

const repeatLabels = { off: 'repeatOff', all: 'repeatAll', one: 'repeatOne' } as const satisfies Record<Repeat, keyof Messages>;

/** Fixed to the bottom edge while a track is current; hiding it never destroys the audio element. No stop button. */
export function PlayerPanel({ state, repeat, shuffle, audio, library, m }: PlayerPanelProps) {
  const range = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // The native `change` event ends a click or drag on the slider; React's `onChange` fires on every `input`.
    const element = range.current!;
    const save = () => { void library.saveSession(); };
    element.addEventListener('change', save);
    return () => element.removeEventListener('change', save);
  }, [library]);
  const active = isActive(state);
  const position = Math.min(state.position, state.duration);
  const time = `${formatTime(position)} / ${formatTime(state.duration)}`;
  return <section className={styles.panel} aria-label={m.player}>
    <div className={styles.inner}>
      <div className={styles.group}>
        <button className={styles.control} aria-label={m.previous} title={m.previous} onClick={() => library.previous()}><Icon name="previous" /></button>
        <button className={styles.play} aria-label={active ? m.pause : m.play} title={active ? m.pause : m.play} onClick={() => audio.toggle()}>
          <Icon name={active ? 'pause' : 'play'} />
        </button>
        <button className={styles.control} aria-label={m.next} title={m.next} onClick={() => library.next()}><Icon name="next" /></button>
      </div>
      <input ref={range} className={styles.progress} type="range" aria-label={m.progress} aria-valuetext={time} min={0} max={state.duration} step="any"
        value={position} disabled={state.duration <= 0} onChange={(event) => audio.seek(event.target.valueAsNumber)} />
      <span className={styles.time}>{time}</span>
      <div className={styles.group}>
        {/* Three states, each with its own look and a label that names it; repeat-one shows the "1" icon. */}
        <button className={styles.control} data-repeat={repeat} aria-label={m[repeatLabels[repeat]]} title={m[repeatLabels[repeat]]}
          onClick={() => library.cycleRepeat()}><Icon name={repeat === 'one' ? 'repeat-one' : 'repeat'} /></button>
        <button className={styles.control} aria-pressed={shuffle} aria-label={m.shuffle} title={m.shuffle} onClick={() => library.toggleShuffle()}>
          <Icon name="shuffle" />
        </button>
        <div className={styles.volumeContainer}>
          <button className={styles.control} aria-pressed={state.muted} aria-label={m.mute} title={m.mute} onClick={() => library.setMuted(!state.muted)}>
            <Icon name={state.muted || state.volume === 0 ? 'volume-off' : 'volume'} />
          </button>
          <input className={styles.volumeSlider} type="range" min={0} max={maxVolume} step={0.005}
            value={state.muted ? 0 : state.volume} aria-label={m.volume}
            onChange={(event) => audio.setVolume(event.target.valueAsNumber)} />
        </div>
      </div>
    </div>
  </section>;
}
