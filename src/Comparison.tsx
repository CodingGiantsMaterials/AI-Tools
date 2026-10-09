import type { CollectionEntry } from './collection/collection-controller';
import type { OriginalUrls } from './images/original';
import type { Messages } from './i18n';
import { comparisonChoices, editableSlot, type ComparisonState, type Slot } from './comparison-state';
import { OriginalImage, useGalleryKeyboard } from './Gallery';
import { Icon } from './Icon';
import styles from './App.module.css';

export function Comparison({ state, entries, urls, m, select, assign, pin }: {
  state: ComparisonState; entries: readonly CollectionEntry[]; urls: OriginalUrls; m: Messages;
  select: (slot: Slot) => void; assign: (entryId: string) => void; pin: (slot: Slot) => void;
}) {
  const choices = comparisonChoices(state, entries);
  const current = choices.findIndex((entry) => entry.entryId === state.slots[editableSlot(state)]?.entryId);
  const canMove = choices.length > (current < 0 ? 0 : 1);
  const move = (direction: number) => {
    const index = current < 0 ? (direction > 0 ? 0 : choices.length - 1) : (current + direction + choices.length) % choices.length;
    if (canMove && choices[index]) assign(choices[index].entryId);
  };
  useGalleryKeyboard(move);
  const neighbors = choices.filter((_, index) => current >= 0 && index !== current &&
    (index === (current + 1) % choices.length || index === (current - 1 + choices.length) % choices.length));
  return <section className={styles.comparison} aria-label={m.comparison}>
    <div className={styles.comparisonFields}>
      {(['A', 'B'] as const).map((slot) => {
        const assignment = state.slots[slot];
        const entry = entries.find((item) => item.entryId === assignment?.entryId);
        const active = state.active === slot, pinned = state.pinned === slot;
        return <section key={slot} className={styles.comparisonSlot} data-slot={slot} data-active={active} data-pinned={pinned} aria-label={`${m.field} ${slot}`}>
          <div className={styles.slotHeader}>
            <button className={styles.slotSelect} aria-pressed={active} aria-label={`${m.field} ${slot}`} onClick={() => select(slot)}>
              {slot}
            </button>
            <button className={styles.pin} disabled={!entry && !pinned} aria-pressed={pinned} aria-label={`${pinned ? m.unpin : m.pin} ${slot}`} title={pinned ? m.unpin : m.pin} onClick={() => pin(slot)}><Icon name="pin" /></button>
          </div>
          <button className={styles.comparisonImage} aria-label={`${m.field} ${slot}${assignment ? `: ${assignment.name}` : ''}`} onClick={() => select(slot)}>
            {entry ? <OriginalImage key={entry.resourceKey} entry={entry} urls={urls} error={m.imageError} /> : <span role="status">{assignment ? m.pinnedUnavailable : m.comparisonEmpty}</span>}
          </button>
          <p className={styles.slotCaption}>{entry?.name ?? assignment?.name ?? m.emptyField}{pinned && <span> · {m.pinned}</span>}</p>
        </section>;
      })}
    </div>
    <div className={styles.comparisonNavigation}>
      <button aria-label={m.previous} title={m.previous} disabled={!canMove} onClick={() => move(-1)}><Icon name="left" /></button>
      <span>{m.editingField} {editableSlot(state)}</span>
      <button aria-label={m.next} title={m.next} disabled={!canMove} onClick={() => move(1)}><Icon name="right" /></button>
    </div>
    <div className={styles.preparedImages} aria-hidden="true">{neighbors.map((entry) => <OriginalImage key={entry.resourceKey} entry={entry} urls={urls} error={m.imageError} />)}</div>
  </section>;
}
