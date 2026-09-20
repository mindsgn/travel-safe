import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureCard } from '@/components/feature-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { strings } from '@/i18n/strings';

export default function AccountScreen() {
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <ThemedView testID="account-screen" style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText testID="account-title" type="smallBold">
              {strings.account.headerTitle}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {strings.account.headerSubtitle}
            </ThemedText>
          </View>

          <FeatureCard body={strings.account.intro.replace('{appName}', strings.appName)} />

          <Pressable
            testID="account-trusted-contacts"
            accessibilityRole="button"
            onPress={() => router.push('/trusted-contacts')}
            style={({ pressed }) => pressed && styles.pressed}>
            <FeatureCard
              title={strings.account.privacyTitle}
              body={`${strings.account.privacyBody} ${strings.account.privacyCta}`}
            />
          </Pressable>

          <Pressable
            testID="account-emergency"
            accessibilityRole="button"
            onPress={() => router.navigate('/emergency')}
            style={({ pressed }) => pressed && styles.pressed}>
            <FeatureCard
              title={strings.account.emergencyTitle}
              body={strings.account.emergencyBody}
            />
          </Pressable>

          <View testID="account-version" style={styles.version}>
            <ThemedText type="small" themeColor="textSecondary">
              {strings.account.version.replace('{version}', version)}
            </ThemedText>
          </View>
        </ScrollView>
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
  scroll: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  version: {
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});