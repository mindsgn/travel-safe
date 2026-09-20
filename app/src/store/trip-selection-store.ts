import { create } from 'zustand';

import type { PlaceSuggestion } from '@/lib/map/geocoding';

export type TripTarget = 'origin' | 'destination';

export type TripPlaces = {
  origin: PlaceSuggestion | null;
  destination: PlaceSuggestion | null;
};

export type TripSelectionState = TripPlaces & {
  selectPlace: (target: TripTarget, place: PlaceSuggestion) => void;
  clear: () => void;
};

export function applySelectedPlace(selected: TripPlaces, target: TripTarget, place: PlaceSuggestion): TripPlaces {
  if (target === 'origin') {
    return { origin: place, destination: selected.destination };
  }
  return { origin: selected.origin, destination: place };
}

export const useTripSelectionStore = create<TripSelectionState>((set) => ({
  origin: null,
  destination: null,
  selectPlace: (target, place) => set((state) => applySelectedPlace(state, target, place)),
  clear: () => set({ origin: null, destination: null }),
}));
