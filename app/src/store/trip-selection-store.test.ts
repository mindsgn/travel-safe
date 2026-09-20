import type { PlaceSuggestion } from '@/lib/map/geocoding';

import { applySelectedPlace, useTripSelectionStore } from './trip-selection-store';

const WOODSTOCK: PlaceSuggestion = {
  id: 'woodstock',
  label: 'Woodstock, Cape Town',
  latitude: -33.927,
  longitude: 18.447,
};

const CBD: PlaceSuggestion = {
  id: 'cbd',
  label: 'Cape Town CBD',
  latitude: -33.9249,
  longitude: 18.4241,
};

describe('trip selection store helpers', () => {
  it('commits a selected place per target', () => {
    const next = applySelectedPlace({ origin: null, destination: null }, 'origin', WOODSTOCK);
    expect(next.origin).toEqual(WOODSTOCK);
    expect(applySelectedPlace(next, 'destination', CBD)).toEqual({ origin: WOODSTOCK, destination: CBD });
  });

  it('overwrites a previous selection for the same target', () => {
    const next = applySelectedPlace(
      applySelectedPlace({ origin: null, destination: null }, 'origin', WOODSTOCK),
      'origin',
      CBD,
    );
    expect(next.origin).toEqual(CBD);
    expect(next.destination).toBeNull();
  });
});

describe('useTripSelectionStore', () => {
  beforeEach(() => {
    useTripSelectionStore.setState({ origin: null, destination: null });
  });

  it('selectPlace keeps origin and destination for the inputs', () => {
    useTripSelectionStore.getState().selectPlace('origin', WOODSTOCK);
    expect(useTripSelectionStore.getState().origin?.label).toBe('Woodstock, Cape Town');
    useTripSelectionStore.getState().selectPlace('destination', CBD);
    expect(useTripSelectionStore.getState().destination?.label).toBe('Cape Town CBD');
    expect(useTripSelectionStore.getState().origin?.label).toBe('Woodstock, Cape Town');
  });

  it('clear discards both selected places', () => {
    useTripSelectionStore.getState().selectPlace('origin', WOODSTOCK);
    useTripSelectionStore.getState().selectPlace('destination', CBD);
    useTripSelectionStore.getState().clear();
    expect(useTripSelectionStore.getState().origin).toBeNull();
    expect(useTripSelectionStore.getState().destination).toBeNull();
  });
});
