import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeHomeStatus } from '@/lib/home-copy';
import type { HomeStatus } from '@/lib/status';

export type StatusCardProps = { status: HomeStatus };

export function StatusCard({ status }: StatusCardProps) {
  const theme = useTheme();
  const copy = describeHomeStatus(status);
  const palette = {
    setup: { background: theme.backgroundElement, accent: theme.textSecondary },
    safe: { background: theme.backgroundSelected, accent: theme.brand },
    due_soon: { background: theme.warningBackground, accent: theme.warning },
    overdue: { background: theme.dangerBackground, accent: theme.danger },
    triggered: { background: theme.dangerBackground, accent: theme.danger },
  }[status.tone];

  return (
    <View
      testID="status-card"
      accessibilityRole="summary"
      accessibilityLabel={`${copy.title}. ${copy.body}`}
      style={[styles.card, { backgroundColor: palette.background, borderColor: palette.accent }]}>
      <View style={styles.titleRow}>
        <View style={[styles.dot, { backgroundColor: palette.accent }]} />
        <ThemedText testID={`status-${status.tone}`} type="smallBold" style={styles.title}>
          {copy.title}
        </ThemedText>
      </View>
      <ThemedText>{copy.body}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, borderWidth: 1, padding: Spacing.four, gap: Spacing.two },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 18, lineHeight: 24 },
});
