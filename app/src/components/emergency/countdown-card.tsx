import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type CountdownCardProps = {
  remainingSeconds: number;
  eyebrow: string;
  prompt: string;
  cancelLabel: string;
  onCancel: () => void;
  testID?: string;
};

export function CountdownCard({
  remainingSeconds,
  eyebrow,
  prompt,
  cancelLabel,
  onCancel,
  testID,
}: CountdownCardProps) {
  return (
    <ThemedView testID={testID} type="backgroundElement" style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {eyebrow}
      </ThemedText>
      <View style={styles.counter}>
        <ThemedText testID="sos-countdown-value" type="title">
          {remainingSeconds}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {prompt}
        </ThemedText>
      </View>
      <PrimaryButton
        testID="sos-cancel"
        variant="subtle"
        label={cancelLabel}
        onPress={onCancel}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  counter: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});