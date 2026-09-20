import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapStatusCard } from '@/components/map/map-status-card';
import { SafetyMap } from '@/components/map/safety-map';
import { SafetyLegend } from '@/components/safety-legend';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMapLocation } from '@/hooks/use-map-location';
import { strings } from '@/i18n/strings';
import type { LivePosition } from '@/lib/location';
import { safetyZonesToHeatmapCells } from '@/lib/map/heatmap-geojson';
import { MOCK_SAFETY_ZONES } from '@/lib/safety-map';

const heatmapCells = safetyZonesToHeatmapCells(MOCK_SAFETY_ZONES);

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { position, accuracyMeters, status, retry } = useMapLocation();

  const liveLocation = useMemo<LivePosition | null>(
    () => (position ? { latitude: position.latitude, longitude: position.longitude } : null),
    [position],
  );

  const showLegend = status === 'ready' || status === 'inaccurate' || status === 'stale';

  return (
    <View testID="explore-screen" style={styles.container}>
      <SafetyMap
        liveLocation={liveLocation}
        accuracyMeters={accuracyMeters}
        heatmapCells={heatmapCells}
      />

      <View style={[styles.overlay, { top: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.headerCard}>
          <ThemedText type="smallBold">{strings.explore.headerTitle}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {strings.explore.headerSubtitle}
          </ThemedText>
        </View>
        <MapStatusCard status={status} onRetry={retry} />
        {showLegend ? <SafetyLegend /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
});