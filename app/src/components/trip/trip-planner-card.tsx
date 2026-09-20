import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripSearchField } from '@/components/trip/trip-search-field';
import { Spacing } from '@/constants/theme';
import { strings } from '@/i18n/strings';
import type { TripPoint } from '@/lib/api/trips';
import { tripPointLabel } from '@/hooks/use-trip-plan';

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
      <ThemedText type="smallBold">{strings.trip.title}</ThemedText>
      <TripSearchField
        testID="trip-origin-input"
        label={strings.trip.originLabel}
        value={origin ? tripPointLabel(origin) : undefined}
        placeholder={strings.trip.originPlaceholder}
        actionLabel={origin || !canUseCurrentLocation ? undefined : strings.trip.useCurrentLocation}
        onAction={origin || !canUseCurrentLocation ? undefined : onUseCurrentLocation}
        onPress={onPressOrigin}
      />
      {origin ? (
        <TripSearchField
          testID="trip-destination-input"
          label={strings.trip.destinationLabel}
          value={destination ? tripPointLabel(destination) : undefined}
          placeholder={strings.trip.destinationPlaceholder}
          onPress={onPressDestination}
        />
      ) : null}
      {!origin ? (
        <View testID="trip-route-hint">
          <ThemedText type="small" themeColor="textSecondary">
            {strings.trip.routeHint}
          </ThemedText>
        </View>
      ) : null}
      {statusMessage ? (
        <View testID="trip-plan-status">
          <ThemedText type="small" themeColor="textSecondary">
            {statusMessage}
          </ThemedText>
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