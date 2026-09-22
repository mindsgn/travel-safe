import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripSearchField } from '@/components/trip/trip-search-field';
import { Spacing } from '@/constants/theme';
import { strings } from '@/i18n/strings';
import type { TripPoint } from '@/lib/api/trips';
import { tripPointLabel } from '@/hooks/use-trip-plan';
import { SymbolView } from 'expo-symbols';


export type TripPlannerCardProps = {
  canUseCurrentLocation: boolean;
  statusMessage?: string | null;
  origin: TripPoint | null;
  destination: TripPoint | null;
  onPressOrigin: () => void;
  onPressDestination: () => void;
  onUseCurrentLocation: () => void;
};

export function TripPlannerCard({
  canUseCurrentLocation,
  statusMessage,
  origin,
  destination,
  onPressOrigin,
  onPressDestination,
  onUseCurrentLocation,
}: TripPlannerCardProps) {
  return (
    <ThemedView type="backgroundSelected" style={styles.card} testID="trip-plan-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TripSearchField
          testID="trip-origin-input"
          label={strings.trip.originLabel}
          value={origin ? tripPointLabel(origin) : undefined}
          placeholder={strings.trip.originPlaceholder}
          actionLabel={origin || !canUseCurrentLocation ? undefined : strings.trip.useCurrentLocation}
          onAction={origin || !canUseCurrentLocation ? undefined : onUseCurrentLocation}
          onPress={onPressOrigin}
        />
        <TouchableOpacity
          onPress={() => onUseCurrentLocation }>
            <SymbolView
              name={{
                ios: 'location.circle.fill',
                android: 'my_location',
              }}
            />
        </TouchableOpacity>
      </View>

      {origin ? (
        <View>
          <TripSearchField
            testID="trip-destination-input"
            label={strings.trip.destinationLabel}
            value={destination ? tripPointLabel(destination) : undefined}
            placeholder={strings.trip.destinationPlaceholder}
            onPress={onPressDestination}
          />
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
