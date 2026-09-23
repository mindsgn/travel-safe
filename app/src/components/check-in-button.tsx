import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n/strings';
import type { HomeTone } from '@/lib/status';

export type CheckInButtonProps = { onPress: () => void; busy: boolean; tone: HomeTone };

export function CheckInButton({ onPress, busy, tone }: CheckInButtonProps) {
  const theme = useTheme();
  const urgent = tone === 'overdue' || tone === 'triggered';
  const background = urgent ? theme.danger : tone === 'due_soon' ? theme.warning : theme.brand;
  const textColor = urgent ? 'dangerText' : 'brandText';

  const press = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onPress();
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        testID="check-in-button"
        accessibilityRole="button"
        accessibilityLabel={strings.home.checkIn}
        accessibilityHint={strings.home.checkInHint}
        accessibilityState={{ busy, disabled: busy }}
        disabled={busy}
        onPress={press}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: background, shadowColor: background },
          pressed && styles.pressed,
        ]}>
        {busy ? <ActivityIndicator color={theme[textColor]} /> : null}
        <ThemedText themeColor={textColor} style={styles.label}>
          {busy ? strings.home.checkingIn : strings.home.checkIn}
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        {strings.home.checkInHint}
      </ThemedText>
    </View>
  );
}

const SIZE = 200;

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: { fontSize: 26, lineHeight: 32, fontWeight: 700 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
});
