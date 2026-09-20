import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { strings } from '@/i18n/strings';
import { safetyHexForScore } from '@/lib/safety-map';

const GRADIENT_HEX_STOPS = [0, 25, 50, 75, 100].map(safetyHexForScore);
const GRADIENT = `linear-gradient(90deg, ${GRADIENT_HEX_STOPS.join(', ')})`;

export type SafetyLegendProps = {
  style?: StyleProp<ViewStyle>;
};

export function SafetyLegend({ style }: SafetyLegendProps) {
  return (
    <ThemedView testID="safety-legend" type="backgroundElement" style={[styles.container, style]}>
      <ThemedText type="smallBold">{strings.safetyMap.legendCaption}</ThemedText>
      <View style={styles.gradientRow}>
        <ThemedText type="small">{strings.legend.dangerous}</ThemedText>
        <View testID="safety-legend-gradient" style={[styles.gradient, { experimental_backgroundImage: GRADIENT }]} />
        <ThemedText type="small">{strings.legend.safe}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  gradientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  gradient: {
    flex: 1,
    minWidth: 160,
    height: 10,
    borderRadius: 5,
  },
});