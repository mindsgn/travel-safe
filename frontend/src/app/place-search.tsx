import { router, useLocalSearchParams } from 'expo-router';

import { PlaceSearchPanel } from '@/components/trip/place-search-panel';
import { strings } from '@/i18n/strings';
import type { TripTarget } from '@/store/trip-selection-store';
import { useTripSelectionStore } from '@/store/trip-selection-store';

export default function PlaceSearchScreen() {
  const params = useLocalSearchParams<{ target?: string }>();
  const target: TripTarget = params.target === 'destination' ? 'destination' : 'origin';
  const setPending = useTripSelectionStore((state) => state.setPending);

  return (
    <PlaceSearchPanel
      title={strings.placeSearch.title}
      subtitle={
        target === 'destination' ? strings.trip.destinationPlaceholder : strings.trip.originPlaceholder
      }
      placeholder={strings.placeSearch.placeholder}
      emptyHint={strings.placeSearch.empty}
      backLabel={strings.placeSearch.back}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      onSelect={(place) => {
        setPending(target, place);
        router.back();
      }}
    />
  );
}