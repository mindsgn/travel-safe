import { markersFromLocations, markerIdFor, USER_LOCATION_MARKER_ID, userLocationMarker } from './markers';

describe('markersFromLocations', () => {
  it('converts domain locations to typed map markers', () => {
    const markers = markersFromLocations([
      { id: 'a', coordinate: { latitude: -33.9, longitude: 18.4 }, kind: 'trusted-contact', title: 'Alex' },
      { coordinate: { latitude: -33.95, longitude: 18.42 }, kind: 'emergency' },
    ]);
    expect(markers).toEqual([
      {
        id: 'a',
        coordinate: { latitude: -33.9, longitude: 18.4 },
        kind: 'trusted-contact',
        title: 'Alex',
      },
      expect.objectContaining({ kind: 'emergency', coordinate: { latitude: -33.95, longitude: 18.42 } }),
    ]);
    expect(markers[1].id).toBeTruthy();
  });

  it('assigns stable ids when none are provided', () => {
    const a = markersFromLocations([{ coordinate: { latitude: -33.9, longitude: 18.4 } }]);
    const b = markersFromLocations([{ coordinate: { latitude: -33.9, longitude: 18.4 } }]);
    expect(a[0].id).toBe(b[0].id);
  });

  it('disambiguates duplicate identifiers deterministically', () => {
    const markers = markersFromLocations([
      { id: 'dup', coordinate: { latitude: -33.9, longitude: 18.4 } },
      { id: 'dup', coordinate: { latitude: -33.9, longitude: 18.4 } },
      { id: 'dup', coordinate: { latitude: -33.9, longitude: 18.4 } },
    ]);
    const ids = markers.map((marker) => marker.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(['dup', 'dup-2', 'dup-3']);
  });

  it('skips invalid locations', () => {
    const markers = markersFromLocations([
      { coordinate: { latitude: 200, longitude: 18.4 } },
      { coordinate: { latitude: -33.9, longitude: 18.4 } },
    ] as never);
    expect(markers).toHaveLength(1);
  });

  it('leaves optional fields out when missing', () => {
    const [marker] = markersFromLocations([{ coordinate: { latitude: -33.9, longitude: 18.4 } }]);
    expect('title' in marker).toBe(false);
    expect('description' in marker).toBe(false);
    expect('color' in marker).toBe(false);
    expect(marker.kind).toBe('generic');
  });
});

describe('userLocationMarker', () => {
  it('builds a user marker with the stable id', () => {
    const marker = userLocationMarker({ latitude: -33.9, longitude: 18.4 });
    expect(marker).toEqual({
      id: USER_LOCATION_MARKER_ID,
      coordinate: { latitude: -33.9, longitude: 18.4 },
      kind: 'user',
    });
  });

  it('returns null for invalid positions', () => {
    expect(userLocationMarker({ latitude: 100, longitude: 18.4 })).toBeNull();
    expect(userLocationMarker({ latitude: Number.NaN, longitude: 18.4 })).toBeNull();
  });

  it('adds title and colour when provided', () => {
    const marker = userLocationMarker({ latitude: -33.9, longitude: 18.4 }, { title: 'You are here', color: '#007AFF' });
    expect(marker?.title).toBe('You are here');
    expect(marker?.color).toBe('#007AFF');
  });
});

describe('markerIdFor', () => {
  it('produces a stable, readable id from coordinates', () => {
    expect(markerIdFor('contact', -33.92491, 18.42411)).toBe('contact--33.924910,18.424110');
    const a = markerIdFor('contact', -33.92491, 18.42411);
    const b = markerIdFor('contact', -33.92491, 18.42411);
    expect(a).toBe(b);
  });
});