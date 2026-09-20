import { metersBetween } from '@/lib/location';
import type { HeatmapCell, TripHeatmap } from '@/lib/api/trips';

export const PATHWAY_HEATMAP_MAX_METERS = 280;

export function resolveVisibleHeatmap(tripCells?: readonly HeatmapCell[] | null): HeatmapCell[] {
  if (tripCells && tripCells.length > 0) {
    return [...tripCells];
  }
  return [];
}

export function shouldShowSafetyLegend(cells: readonly HeatmapCell[]): boolean {
  return cells.length > 0;
}

export function heatmapHasCells(heatmap: TripHeatmap | null | undefined): boolean {
  return Boolean(heatmap && heatmap.cells.length > 0);
}

export function isBackendHeatmap(heatmap: TripHeatmap | null | undefined): boolean {
  if (!heatmap || heatmap.cells.length === 0) return false;
  return heatmap.cells.every((cell) => cell.source_id !== 'local-mock');
}

function distanceToSegmentMeters(
  point: { latitude: number; longitude: number },
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
): number {
  const dx = end.longitude - start.longitude;
  const dy = end.latitude - start.latitude;
  if (dx === 0 && dy === 0) return metersBetween(point, start);
  const t = Math.min(
    1,
    Math.max(0, ((point.longitude - start.longitude) * dx + (point.latitude - start.latitude) * dy) / (dx * dx + dy * dy)),
  );
  return metersBetween(point, {
    longitude: start.longitude + t * dx,
    latitude: start.latitude + t * dy,
  });
}

export function distanceToPathwayMeters(
  point: { latitude: number; longitude: number },
  coordinates: readonly [number, number][],
): number {
  if (coordinates.length === 0) return Number.POSITIVE_INFINITY;
  if (coordinates.length === 1) {
    return metersBetween(point, { longitude: coordinates[0][0], latitude: coordinates[0][1] });
  }
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = { longitude: coordinates[index][0], latitude: coordinates[index][1] };
    const end = { longitude: coordinates[index + 1][0], latitude: coordinates[index + 1][1] };
    nearest = Math.min(nearest, distanceToSegmentMeters(point, start, end));
  }
  return nearest;
}

export function filterHeatmapToPathway(
  cells: readonly HeatmapCell[],
  coordinates: readonly [number, number][],
  maxMeters = PATHWAY_HEATMAP_MAX_METERS,
): HeatmapCell[] {
  if (coordinates.length < 2) return [];
  return cells.filter(
    (cell) =>
      cell.source_id !== 'local-mock' &&
      distanceToPathwayMeters({ latitude: cell.latitude, longitude: cell.longitude }, coordinates) <= maxMeters,
  );
}
