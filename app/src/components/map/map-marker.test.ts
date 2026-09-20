import { markerPinColor } from './map-marker';

describe('markerPinColor', () => {
  const coordinate = { latitude: -33.9, longitude: 18.4 };

  it('prefers an explicit color', () => {
    expect(markerPinColor({ id: 'a', coordinate, kind: 'generic', color: '#ff00aa' })).toBe('#ff00aa');
  });

  it('uses kind defaults', () => {
    expect(markerPinColor({ id: 'u', coordinate, kind: 'user' })).toBe('#007AFF');
    expect(markerPinColor({ id: 'e', coordinate, kind: 'emergency' })).toBe('#e5484d');
    expect(markerPinColor({ id: 'g', coordinate, kind: 'generic' })).toBe('#111111');
  });
});
