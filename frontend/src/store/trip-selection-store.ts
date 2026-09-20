import { create } from 'zustand';

import type { PlaceSuggestion } from '@/lib/map/geocoding';

export type TripTarget = 'origin' | 'destination';

export type PendingSelection = Partial<Record<TripTarget, PlaceSuggestion>>;

export type TripSelectionState = {
  pending: PendingSelection;
  setPending: (target: TripTarget, place: PlaceSuggestion) => void;
  consume: (target: TripTarget) => PlaceSuggestion | null;
  clear: () => void;
};

export function applyPendingSelection(
  pending: PendingSelection,
  target: TripTarget,
  place: PlaceSuggestion,
): PendingSelection {
  return { ...pending, [target]: place };
}

export function consumePendingSelection(
  pending: PendingSelection,
  target: TripTarget,
): { place: PlaceSuggestion | null; next: PendingSelection } {
  const place = pending[target] ?? null;
  if (!place) return { place, next: pending };
  const next = { ...pending };
  delete next[target];
  return { place, next };
}

export const useTripSelectionStore = create<TripSelectionState>((set, get) => ({
  pending: {},
  setPending: (target, place) => set((state) => ({ pending: applyPendingSelection(state.pending, target, place) })),
  consume: (target) => {
    const { place, next } = consumePendingSelection(get().pending, target);
    if (!place) return null;
    set({ pending: next });
    return place;
  },
  clear: () => set({ pending: {} }),
}));