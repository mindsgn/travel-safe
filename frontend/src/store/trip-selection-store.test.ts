import type { PlaceSuggestion } from '@/lib/map/geocoding';

import {
  applyPendingSelection,
  consumePendingSelection,
  useTripSelectionStore,
} from './trip-selection-store';

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
  it('stages a pending selection per target', () => {
    const pending = applyPendingSelection({}, 'origin', WOODSTOCK);
    expect(pending.origin).toEqual(WOODSTOCK);
    const withDestination = applyPendingSelection(pending, 'destination', CBD);
    expect(withDestination).toEqual({ origin: WOODSTOCK, destination: CBD });
  });

  it('overwrites a previous selection for the same target', () => {
    const pending = applyPendingSelection(
      applyPendingSelection({}, 'origin', WOODSTOCK),
      'origin',
      CBD,
    );
    expect(pending.origin).toEqual(CBD);
  });

  it('consumes and removes a pending selection', () => {
    const pending = applyPendingSelection({}, 'origin', WOODSTOCK);
    const { place, next } = consumePendingSelection(pending, 'origin');
    expect(place).toEqual(WOODSTOCK);
    expect(next.origin).toBeUndefined();
  });

  it('consuming an empty target returns null without mutating', () => {
    const pending = { destination: CBD };
    const { place, next } = consumePendingSelection(pending, 'origin');
    expect(place).toBeNull();
    expect(next).toEqual(pending);
  });
});

describe('useTripSelectionStore', () => {
  beforeEach(() => {
    useTripSelectionStore.setState({ pending: {} });
  });

  it('setPending stages a selection for the origin', () => {
    useTripSelectionStore.getState().setPending('origin', WOODSTOCK);
    expect(useTripSelectionStore.getState().pending.origin).toEqual(WOODSTOCK);
  });

  it('consume returns the staged selection and clears it', () => {
    useTripSelectionStore.getState().setPending('origin', WOODSTOCK);
    const place = useTripSelectionStore.getState().consume('origin');
    expect(place).toEqual(WOODSTOCK);
    expect(useTripSelectionStore.getState().pending.origin).toBeUndefined();
  });

  it('consume returns null when nothing is pending', () => {
    expect(useTripSelectionStore.getState().consume('destination')).toBeNull();
  });

  it('clear discards all pending selections', () => {
    useTripSelectionStore.getState().setPending('origin', WOODSTOCK);
    useTripSelectionStore.getState().setPending('destination', CBD);
    useTripSelectionStore.getState().clear();
    expect(useTripSelectionStore.getState().pending).toEqual({});
  });
});