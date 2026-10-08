import type { CollectionEntry } from './collection/collection-controller';

export type Slot = 'A' | 'B';
type Assignment = { entryId: string; name: string } | null;
const assignment = (entry: CollectionEntry | null | undefined): Assignment => entry ? { entryId: entry.entryId, name: entry.name } : null;
export interface ComparisonState {
  generation: number;
  slots: Record<Slot, Assignment>;
  active: Slot;
  pinned: Slot | null;
}
export const otherSlot = (slot: Slot): Slot => slot === 'A' ? 'B' : 'A';
export const editableSlot = (state: ComparisonState): Slot => state.pinned === state.active ? otherSlot(state.active) : state.active;

export function createComparison(generation: number, entries: readonly CollectionEntry[], activeId: string | null): ComparisonState {
  const first = entries.find((entry) => entry.entryId === activeId) ?? entries[0] ?? null;
  return { generation, slots: { A: assignment(first), B: assignment(entries.find((entry) => entry.entryId !== first?.entryId)) }, active: 'A', pinned: null };
}

/** Pinned assignments survive disappearance; other fields use distinct available entries. */
export function reconcileComparison(state: ComparisonState, generation: number, entries: readonly CollectionEntry[], activeId: string | null): ComparisonState {
  if (state.generation !== generation) return createComparison(generation, entries, activeId);
  let next = state;
  for (const slot of ['A', 'B'] as const) {
    if (slot === state.pinned) continue;
    const assigned = next.slots[slot];
    if (assigned && entries.some((entry) => entry.entryId === assigned.entryId)) continue;
    const replacement = entries.find((entry) => entry.entryId !== next.slots[otherSlot(slot)]?.entryId) ?? null;
    if (assigned?.entryId !== replacement?.entryId) next = { ...next, slots: { ...next.slots, [slot]: assignment(replacement) } };
  }
  return next;
}

export function assignComparison(state: ComparisonState, entry: CollectionEntry): ComparisonState {
  const target = editableSlot(state), other = otherSlot(target);
  // Selecting an already displayed image inspects it, without duplicating or displacing it.
  if (state.slots[other]?.entryId === entry.entryId) return { ...state, active: other };
  return { ...state, slots: { ...state.slots, [target]: { entryId: entry.entryId, name: entry.name } }, active: target };
}

export function pinComparison(state: ComparisonState, slot: Slot): ComparisonState {
  return state.pinned === slot ? { ...state, pinned: null } : { ...state, pinned: slot, active: otherSlot(slot) };
}

export function comparisonChoices(state: ComparisonState, entries: readonly CollectionEntry[]): readonly CollectionEntry[] {
  return entries.filter((entry) => entry.entryId !== state.slots[otherSlot(editableSlot(state))]?.entryId);
}
