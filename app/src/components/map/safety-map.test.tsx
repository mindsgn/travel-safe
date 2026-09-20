import { act, create } from 'react-test-renderer';
import { Platform } from 'react-native';

import { SafetyMap } from './safety-map';

describe('SafetyMap', () => {
  it('renders the web fallback on web', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SafetyMap />);
    });
    expect(renderer.root.findByProps({ testID: 'safety-map' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'map-view' })).toHaveLength(0);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });

  it('renders heatmap and pathway containers on native', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <SafetyMap
          heatmapCells={[
            {
              id: 'cell-1',
              latitude: -33.93,
              longitude: 18.43,
              label: 'Mock',
              reported_crimes: 4,
              relative_intensity: 0.4,
              resolution: 'precinct_aggregate',
              source_id: 'mock',
            },
          ]}
          pathwayCoordinates={[
            [18.42, -33.92],
            [18.45, -33.93],
          ]}
        />,
      );
    });
    expect(renderer.root.findByProps({ testID: 'map-view' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'trip-heatmap' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'trip-pathway' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'map-zoom-in' })).toBeTruthy();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });
});
