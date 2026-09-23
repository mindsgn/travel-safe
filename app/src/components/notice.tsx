import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

export type NoticeProps = {
  tone?: NoticeTone;
  message: string;
  testID?: string;
  action?: ReactNode;
};

export function Notice({ tone = 'info', message, testID, action }: NoticeProps) {
  const theme = useTheme();
  const palette = {
    info: { background: theme.backgroundElement, border: theme.border },
    success: { background: theme.backgroundSelected, border: theme.brand },
    warning: { background: theme.warningBackground, border: theme.warning },
    danger: { background: theme.dangerBackground, border: theme.danger },
  }[tone];

  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <ThemedText type="small">{message}</ThemedText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
