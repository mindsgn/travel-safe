import { create } from 'zustand';

import type { LocationHeatmap } from '@/lib/api/location';

export type LocationHeatmapState = {
  heatmap: LocationHeatmap | null;
  setHeatmap: (heatmap: LocationHeatmap | null) => void;
};

export const useLocationHeatmapStore = create<LocationHeatmapState>((set) => ({
  heatmap: null,
  setHeatmap: (heatmap) => set({ heatmap }),
}));
