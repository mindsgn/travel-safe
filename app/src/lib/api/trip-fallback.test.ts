import { buildClientTripPlan } from './trip-fallback';

describe('buildClientTripPlan', () => {
  it('builds a mock pathway between origin and destination', () => {
    const plan = buildClientTripPlan(
      { latitude: -33.9249, longitude: 18.4241, label: 'CBD' },
      { latitude: -33.927, longitude: 18.447, label: 'Woodstock' },
    );
    expect(plan.pathway.provider).toBe('mock');
    expect(plan.pathway.coordinates[0]).toEqual([18.4241, -33.9249]);
    expect(plan.pathway.coordinates[1]).toEqual([18.447, -33.927]);
    expect(plan.heatmap.cells.length).toBeGreaterThan(0);
    expect(plan.heatmap.bbox[0]).toBeLessThanOrEqual(plan.heatmap.bbox[2]);
  });
});
