import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ListRowProps = {
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
  destructive?: boolean;
  testID: string;
};

export function ListRow({ label, value, hint, onPress, destructive = false, testID }: ListRowProps) {
  const theme = useTheme();

  const content = (
    <>
      <View style={styles.text}>
        <ThemedText type="smallBold" themeColor={destructive ? 'danger' : 'text'}>
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {value ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.value} numberOfLines={2}>
          {value}
        </ThemedText>
      ) : null}
      {onPress ? <ThemedText themeColor="textSecondary">›</ThemedText> : null}
    </>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={[styles.row, { borderColor: theme.border }]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  text: { flex: 1, gap: Spacing.half },
  value: { maxWidth: '50%', textAlign: 'right' },
  pressed: { opacity: 0.6 },
});
