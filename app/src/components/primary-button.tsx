import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'subtle' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  testID,
  style,
}: PrimaryButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const background = { primary: theme.brand, subtle: theme.backgroundElement, danger: theme.danger }[variant];
  const textColor = variant === 'primary' ? 'brandText' : variant === 'danger' ? 'dangerText' : 'text';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: background },
        variant === 'subtle' && { borderColor: theme.border, borderWidth: 1 },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {loading ? <ActivityIndicator color={theme[textColor]} /> : null}
      <ThemedText type="smallBold" themeColor={textColor}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
