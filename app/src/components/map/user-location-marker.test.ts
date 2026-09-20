import { accuracyHaloGeoJSON } from './user-location-marker';

describe('accuracyHaloGeoJSON', () => {
  it('builds a point feature at the user coordinate', () => {
    const geojson = accuracyHaloGeoJSON({ latitude: -33.92, longitude: 18.42 });
    expect(geojson.features[0]?.geometry.coordinates).toEqual([18.42, -33.92]);
  });
});
