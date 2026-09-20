import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'subtle';
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  testID,
  style,
}: PrimaryButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary'
          ? { backgroundColor: theme.brand }
          : { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <ThemedText
        type="smallBold"
        themeColor={variant === 'primary' ? 'brandText' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});