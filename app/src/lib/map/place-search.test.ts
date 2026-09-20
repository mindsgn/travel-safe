import { INITIAL_PLACE_SEARCH, reducePlaceSearch, shouldSearchPlaces } from './place-search';

const SUGGESTION = {
  id: 'woodstock',
  label: 'Woodstock, Cape Town',
  latitude: -33.927,
  longitude: 18.447,
};

describe('place search reducer', () => {
  it('starts searching after two characters', () => {
    expect(shouldSearchPlaces('w')).toBe(false);
    const next = reducePlaceSearch(INITIAL_PLACE_SEARCH, { type: 'query', query: 'wo' });
    expect(next.status).toBe('loading');
    expect(next.open).toBe(true);
    expect(shouldSearchPlaces(next.query)).toBe(true);
  });

  it('stores results and a selected place', () => {
    const withResults = reducePlaceSearch(INITIAL_PLACE_SEARCH, {
      type: 'results',
      suggestions: [SUGGESTION],
    });
    expect(withResults.suggestions).toHaveLength(1);
    const selected = reducePlaceSearch(withResults, { type: 'select', suggestion: SUGGESTION });
    expect(selected.selected).toEqual(SUGGESTION);
    expect(selected.open).toBe(false);
    expect(selected.query).toBe(SUGGESTION.label);
  });

  it('clears and closes', () => {
    const filled = reducePlaceSearch(INITIAL_PLACE_SEARCH, { type: 'query', query: 'wood' });
    expect(reducePlaceSearch(filled, { type: 'clear' })).toEqual(INITIAL_PLACE_SEARCH);
    expect(reducePlaceSearch(filled, { type: 'close' }).open).toBe(false);
    expect(reducePlaceSearch(filled, { type: 'failed' }).status).toBe('error');
    expect(reducePlaceSearch(filled, { type: 'loading' }).status).toBe('loading');
  });
});
