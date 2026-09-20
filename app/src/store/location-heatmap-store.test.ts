import { useLocationHeatmapStore } from './location-heatmap-store';

describe('location heatmap store', () => {
  beforeEach(() => {
    useLocationHeatmapStore.setState({ heatmap: null });
  });

  it('stores the latest location heatmap', () => {
    const heatmap = {
      latitude: -33.92,
      longitude: 18.42,
      heatmap: { bbox: [0, 0, 0, 0] as [number, number, number, number], zoom: 14, cells: [], normalization: '', caveats: [] },
    };
    useLocationHeatmapStore.getState().setHeatmap(heatmap);
    expect(useLocationHeatmapStore.getState().heatmap).toEqual(heatmap);
  });
});
