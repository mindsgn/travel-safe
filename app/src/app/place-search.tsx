import { router, useLocalSearchParams } from 'expo-router';

import { PlaceSearchPanel } from '@/components/trip/place-search-panel';
import { strings } from '@/i18n/strings';
import type { TripTarget } from '@/store/trip-selection-store';
import { useTripSelectionStore } from '@/store/trip-selection-store';

export default function PlaceSearchScreen() {
  const params = useLocalSearchParams<{ target?: string }>();
  const target: TripTarget = params.target === 'destination' ? 'destination' : 'origin';
  const selectPlace = useTripSelectionStore((state) => state.selectPlace);

  return (
    <PlaceSearchPanel
      title={strings.placeSearch.title}
      subtitle={strings.placeSearch.subtitle}
      placeholder={strings.placeSearch.placeholder}
      emptyHint={strings.placeSearch.empty}
      backLabel={strings.placeSearch.back}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      onSelect={(place) => {
        selectPlace(target, place);
        router.back();
      }}
    />
  );
}