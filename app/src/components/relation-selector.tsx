import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RELATIONSHIPS, type RelationshipKey } from '@/lib/trusted-contacts';

export type RelationSelectorProps = {
  value: RelationshipKey;
  onChange: (value: RelationshipKey) => void;
  getLabel: (value: RelationshipKey) => string;
};

export function RelationSelector({ value, onChange, getLabel }: RelationSelectorProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {RELATIONSHIPS.map((key) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            testID={`relation-chip-${key}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
              {getLabel(key)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});