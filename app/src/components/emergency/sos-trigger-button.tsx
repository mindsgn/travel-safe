import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type SosTriggerButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

export function SosTriggerButton({ label, onPress, disabled = false, testID }: SosTriggerButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.circle,
        { backgroundColor: theme.danger, shadowColor: theme.danger },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <ThemedText type="title" themeColor="dangerText">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 184,
    height: 184,
    borderRadius: 92,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.4,
  },
});