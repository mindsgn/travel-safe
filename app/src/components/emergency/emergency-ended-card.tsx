import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type EmergencyEndedCardProps = {
  title: string;
  body: string;
  doneLabel: string;
  onDone: () => void;
  testID?: string;
};

export function EmergencyEndedCard({ title, body, doneLabel, onDone, testID }: EmergencyEndedCardProps) {
  return (
    <ThemedView testID={testID} type="backgroundElement" style={styles.container}>
      <View style={styles.copy}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {body}
        </ThemedText>
      </View>
      <PrimaryButton testID="sos-done" label={doneLabel} onPress={onDone} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  copy: {
    gap: Spacing.two,
  },
});