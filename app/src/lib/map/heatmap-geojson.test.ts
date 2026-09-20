import { MOCK_SAFETY_ZONES } from '@/lib/safety-map';

import {
  heatmapCellsToGeoJSON,
  pathwayCoordinatesToMap,
  pathwayToLineGeoJSON,
  safetyZonesToHeatmapCells,
} from './heatmap-geojson';

describe('heatmap geojson', () => {
  it('converts heatmap cells into point features', () => {
    const geojson = heatmapCellsToGeoJSON([
      {
        id: 'cell-1',
        latitude: -33.93,
        longitude: 18.43,
        label: 'Mock',
        reported_crimes: 10,
        relative_intensity: 0.5,
        resolution: 'precinct_aggregate',
        source_id: 'mock',
      },
    ]);
    expect(geojson.features[0]?.geometry.coordinates).toEqual([18.43, -33.93]);
    expect(geojson.features[0]?.properties.weight).toBe(0.5);
  });

  it('maps safety zones into a dense crime-intensity grid', () => {
    const cells = safetyZonesToHeatmapCells(MOCK_SAFETY_ZONES);
    expect(cells.length).toBeGreaterThan(MOCK_SAFETY_ZONES.length);
    expect(cells.every((cell) => cell.relative_intensity >= 0 && cell.relative_intensity <= 1)).toBe(true);
  });

  it('converts a pathway into a line feature and map coordinates', () => {
    const coordinates: [number, number][] = [
      [18.42, -33.92],
      [18.45, -33.93],
    ];
    const line = pathwayToLineGeoJSON({ coordinates });
    expect(line.features[0]?.geometry.type).toBe('LineString');
    expect(pathwayCoordinatesToMap(coordinates)[0]).toEqual({ longitude: 18.42, latitude: -33.92 });
  });
});
