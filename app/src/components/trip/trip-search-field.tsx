import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export type TripSearchFieldProps = {
  testID: string;
  label: string;
  value?: string | null;
  placeholder: string;
  actionLabel?: string;
  onAction?: () => void;
  onPress: () => void;
};

export function TripSearchField({
  testID,
  label,
  value,
  placeholder,
  actionLabel,
  onAction,
  onPress,
}: TripSearchFieldProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        {actionLabel && onAction ? (
          <Pressable
            testID={`${testID}-action`}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            hitSlop={8}>
            <ThemedText type="smallBold" themeColor="brandText">
              {actionLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
        {value ? (
          <ThemedText testID={`${testID}-value`} type="small" numberOfLines={1} style={styles.value}>
            {value}
          </ThemedText>
        ) : (
          <ThemedText type="small" style={styles.placeholder}>
            {placeholder}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  field: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#ffffff',
    minHeight: 48,
    justifyContent: 'center',
  },
  value: {
    color: '#111827',
  },
  placeholder: {
    color: '#6b7280',
  },
  pressed: {
    opacity: 0.7,
  },
});
