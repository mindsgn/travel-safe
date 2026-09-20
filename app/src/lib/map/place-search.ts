import type { PlaceSuggestion } from '@/lib/map/geocoding';

export type PlaceSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export type PlaceSearchState = {
  query: string;
  suggestions: PlaceSuggestion[];
  selected: PlaceSuggestion | null;
  status: PlaceSearchStatus;
  open: boolean;
};

export type PlaceSearchAction =
  | { type: 'query'; query: string }
  | { type: 'loading' }
  | { type: 'results'; suggestions: PlaceSuggestion[] }
  | { type: 'failed' }
  | { type: 'select'; suggestion: PlaceSuggestion }
  | { type: 'clear' }
  | { type: 'close' };

export const INITIAL_PLACE_SEARCH: PlaceSearchState = {
  query: '',
  suggestions: [],
  selected: null,
  status: 'idle',
  open: false,
};

export function reducePlaceSearch(state: PlaceSearchState, action: PlaceSearchAction): PlaceSearchState {
  switch (action.type) {
    case 'query':
      return {
        ...state,
        query: action.query,
        selected: null,
        open: action.query.trim().length >= 2,
        status: action.query.trim().length >= 2 ? 'loading' : 'idle',
        suggestions: action.query.trim().length >= 2 ? state.suggestions : [],
      };
    case 'loading':
      return { ...state, status: 'loading' };
    case 'results':
      return { ...state, status: 'ready', suggestions: action.suggestions, open: true };
    case 'failed':
      return { ...state, status: 'error', suggestions: [], open: false };
    case 'select':
      return {
        ...state,
        query: action.suggestion.label,
        selected: action.suggestion,
        suggestions: [],
        open: false,
        status: 'ready',
      };
    case 'clear':
      return INITIAL_PLACE_SEARCH;
    case 'close':
      return { ...state, open: false };
    default:
      return state;
  }
}

export function shouldSearchPlaces(query: string): boolean {
  return query.trim().length >= 2;
}
