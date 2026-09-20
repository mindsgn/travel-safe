import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { strings } from '@/i18n/strings';
import type { MapLocationStatus } from '@/lib/map/map.types';

export type MapStatusCardProps = {
  status: MapLocationStatus;
  onRetry?: () => void;
};

function copyFor(status: MapLocationStatus): { testID: string; title: string; body: string; loading: boolean } {
  switch (status) {
    case 'locating':
      return { testID: 'map-loading', title: strings.safetyMap.locating, body: '', loading: true };
    case 'permission-denied':
      return {
        testID: 'map-permission-denied',
        title: strings.safetyMap.permissionDeniedTitle,
        body: strings.safetyMap.permissionDeniedBody,
        loading: false,
      };
    case 'services-disabled':
      return {
        testID: 'map-services-disabled',
        title: strings.safetyMap.servicesDisabledTitle,
        body: strings.safetyMap.servicesDisabledBody,
        loading: false,
      };
    case 'gps-unavailable':
      return {
        testID: 'map-gps-unavailable',
        title: strings.safetyMap.gpsUnavailableTitle,
        body: strings.safetyMap.gpsUnavailableBody,
        loading: false,
      };
    case 'inaccurate':
      return {
        testID: 'map-inaccurate',
        title: strings.safetyMap.inaccurateTitle,
        body: strings.safetyMap.inaccurateBody,
        loading: false,
      };
    default:
      return {
        testID: 'map-location-error',
        title: strings.safetyMap.locationUnavailable,
        body: '',
        loading: false,
      };
  }
}

export function MapStatusCard({ status, onRetry }: MapStatusCardProps) {
  if (status === 'idle' || status === 'ready' || status === 'stale') return null;

  const { testID, title, body, loading } = copyFor(status);

  return (
    <ThemedView testID={testID} type="backgroundElement" style={styles.container}>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator testID="map-loading-indicator" size="small" />
          <ThemedText type="smallBold">{title}</ThemedText>
        </View>
      ) : (
        <>
          <ThemedText type="smallBold">{title}</ThemedText>
          {body ? (
            <ThemedText type="small" themeColor="textSecondary">
              {body}
            </ThemedText>
          ) : null}
          {onRetry ? (
            <Pressable
              testID="map-retry"
              accessibilityRole="button"
              accessibilityLabel={strings.safetyMap.retry}
              onPress={onRetry}
              style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
              <ThemedText type="smallBold">{strings.safetyMap.retry}</ThemedText>
            </Pressable>
          ) : null}
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  retry: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginTop: Spacing.one,
  },
  retryPressed: {
    opacity: 0.7,
  },
});