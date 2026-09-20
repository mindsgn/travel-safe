import { act, create } from 'react-test-renderer';

import { PlaceSearchPanel } from './place-search-panel';

jest.mock('react-native-safe-area-context', () => {
  const { SafeAreaProvider, initialWindowMetrics } =
    jest.requireActual('react-native-safe-area-context/jest/mock');
  return { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});

const PLACE = {
  id: 'woodstock',
  label: 'Woodstock, Cape Town',
  latitude: -33.927,
  longitude: 18.447,
};

function findByTestID(root: ReturnType<typeof create>, testID: string) {
  const match = root.root.findAll((node) => node.props.testID === testID);
  if (match.length === 0) throw new Error(`No testID "${testID}" found`);
  return match[0];
}

function invokeChangeText(root: ReturnType<typeof create>, value: string) {
  const match = root.root.findAll(
    (node) => node.props.testID === 'place-search-input' && typeof node.props.onChangeText === 'function',
  );
  if (match.length === 0) throw new Error('No place-search-input found');
  match[0].props.onChangeText(value);
}

function renderPanel(overrides: Partial<Parameters<typeof PlaceSearchPanel>[0]> = {}) {
  return create(
    <PlaceSearchPanel
      title="Search places"
      subtitle="Pick a location"
      placeholder="Search a place"
      emptyHint="Keep typing"
      backLabel="Back"
      onSelect={jest.fn()}
      onBack={jest.fn()}
      search={jest.fn().mockResolvedValue([PLACE])}
      debounceMs={0}
      {...overrides}
    />,
  );
}

describe('PlaceSearchPanel', () => {
  it('shows the empty hint before a query is typed', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = renderPanel();
    });
    expect(findByTestID(renderer, 'place-search-screen')).toBeTruthy();
    expect(findByTestID(renderer, 'place-search-empty')).toBeTruthy();
  });

  it('searches and selects a suggestion', async () => {
    const onSelect = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = renderPanel({ onSelect });
    });

    act(() => {
      invokeChangeText(renderer, 'wood');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(findByTestID(renderer, 'place-search-results').props.testID).toBeTruthy();
    act(() => {
      findByTestID(renderer, 'place-search-suggestion-0').props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith(PLACE);
  });

  it('invokes onBack from the back control', () => {
    const onBack = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = renderPanel({ onBack });
    });
    act(() => {
      findByTestID(renderer, 'place-search-back').props.onPress();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('passes the proximity to the search function', async () => {
    const search = jest.fn().mockResolvedValue([PLACE]);
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = renderPanel({ search, proximity: { latitude: -33.9, longitude: 18.4 } });
    });
    act(() => {
      invokeChangeText(renderer, 'wood');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(search).toHaveBeenCalledWith('wood', { proximity: { latitude: -33.9, longitude: 18.4 } });
  });
});