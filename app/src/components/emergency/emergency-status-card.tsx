import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type EmergencyInfoRow = {
  label: string;
  value: string;
  valueTestID?: string;
};

export type EmergencyStatusCardProps = {
  statusTitle: string;
  statusBody: string;
  alertStatus: string;
  rows: EmergencyInfoRow[];
  endLabel: string;
  onEnd: () => void;
  testID?: string;
};

export function EmergencyStatusCard({
  statusTitle,
  statusBody,
  alertStatus,
  rows,
  endLabel,
  onEnd,
  testID,
}: EmergencyStatusCardProps) {
  return (
    <ThemedView testID={testID} type="backgroundElement" style={styles.container}>
      <ThemedText type="smallBold">{statusTitle}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {statusBody}
      </ThemedText>
      <ThemedText testID="sos-alert-status" type="small" themeColor="textSecondary">
        {alertStatus}
      </ThemedText>

      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">
              {row.label}
            </ThemedText>
            <ThemedText testID={row.valueTestID ?? 'sos-info-value'} type="smallBold">
              {row.value}
            </ThemedText>
          </View>
        ))}
      </View>

      <PrimaryButton testID="sos-end" label={endLabel} onPress={onEnd} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  rows: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});