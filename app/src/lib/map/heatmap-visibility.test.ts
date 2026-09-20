import {
  filterHeatmapToPathway,
  heatmapHasCells,
  isBackendHeatmap,
  resolveVisibleHeatmap,
  shouldShowSafetyLegend,
} from './heatmap-visibility';
import type { HeatmapCell } from '@/lib/api/trips';

const cell: HeatmapCell = {
  id: 'cell-1',
  latitude: -33.9249,
  longitude: 18.4241,
  label: 'Mock',
  reported_crimes: 4,
  relative_intensity: 0.4,
  resolution: 'precinct_aggregate',
  source_id: 'sqlite-precincts',
};

const pathway: [number, number][] = [
  [18.4241, -33.9249],
  [18.4300, -33.9249],
  [18.4470, -33.927],
];

describe('heatmap visibility', () => {
  it('hides the heatmap until backend trip cells exist', () => {
    expect(resolveVisibleHeatmap()).toEqual([]);
    expect(resolveVisibleHeatmap([])).toEqual([]);
    expect(shouldShowSafetyLegend([])).toBe(false);
    expect(heatmapHasCells({ bbox: [0, 0, 0, 0], zoom: 12, cells: [], normalization: '', caveats: [] })).toBe(
      false,
    );
    expect(isBackendHeatmap({ bbox: [0, 0, 0, 0], zoom: 12, cells: [], normalization: '', caveats: [] })).toBe(
      false,
    );
  });

  it('keeps backend cells that sit on the searched pathway', () => {
    expect(resolveVisibleHeatmap([cell])[0]?.id).toBe('cell-1');
    expect(shouldShowSafetyLegend([cell])).toBe(true);
    expect(isBackendHeatmap({ bbox: [0, 0, 0, 0], zoom: 12, cells: [cell], normalization: '', caveats: [] })).toBe(
      true,
    );
    expect(filterHeatmapToPathway([cell], pathway)).toEqual([cell]);
  });

  it('drops mock city-wide cells and points far from the pathway', () => {
    const mock: HeatmapCell = { ...cell, id: 'mock', source_id: 'local-mock' };
    const far: HeatmapCell = { ...cell, id: 'far', latitude: -33.9516, longitude: 18.3825 };
    expect(filterHeatmapToPathway([mock, far, cell], pathway).map((item) => item.id)).toEqual(['cell-1']);
    expect(filterHeatmapToPathway([cell], [])).toEqual([]);
  });
});
