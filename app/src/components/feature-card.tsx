import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type FeatureCardProps = {
  title?: string;
  body?: string;
  step?: string;
  testID?: string;
  children?: ReactNode;
};

export function FeatureCard({ title, body, step, testID, children }: FeatureCardProps) {
  return (
    <ThemedView testID={testID} type="backgroundElement" style={styles.container}>
      {step ? (
        <ThemedText type="small" themeColor="textSecondary">
          {step}
        </ThemedText>
      ) : null}
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
      {body ? (
        <ThemedText type="small" themeColor="textSecondary">
          {body}
        </ThemedText>
      ) : null}
      {children ? <View style={styles.children}>{children}</View> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  children: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
});