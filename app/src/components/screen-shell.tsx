import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n/strings';

export type ScreenShellProps = {
  title?: string;
  subtitle?: string;
  testID?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function ScreenShell({ title, subtitle, testID, footer, children }: ScreenShellProps) {
  const theme = useTheme();

  return (
    <ThemedView testID={testID} style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            testID="screen-back"
            accessibilityRole="button"
            accessibilityLabel={strings.trustedContacts.nav.back}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={8}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">←</ThemedText>
          </Pressable>
          <View style={styles.headerText}>
            {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
  scroll: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
});