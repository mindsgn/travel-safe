import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureCard } from '@/components/feature-card';
import { ListRow } from '@/components/list-row';
import { Notice } from '@/components/notice';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useGuardedAction } from '@/hooks/use-guarded-action';
import { format, plural } from '@/i18n/format';
import { strings } from '@/i18n/strings';
import { formatDate, parseDate } from '@/lib/dates';
import { formatInterval } from '@/lib/intervals';
import { stopJourneyTracking } from '@/lib/location';
import { useAppStore } from '@/store';

export default function AccountScreen() {
  const copy = strings.account;
  const name = useAppStore((state) => state.name);
  const createdAt = useAppStore((state) => state.profileCreatedAt);
  const intervalDays = useAppStore((state) => state.intervalDays);
  const contactCount = useAppStore((state) => state.contacts.length);
  const journeySharing = useAppStore((state) => state.journeySharing);
  const syncError = useAppStore((state) => state.syncError);
  const deleteAccount = useAppStore((state) => state.deleteAccount);
  const guarded = useGuardedAction();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const memberSince = parseDate(createdAt);

  const confirmDelete = () =>
    guarded(() =>
      Alert.alert(copy.deleteConfirmTitle, copy.deleteConfirmBody, [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: copy.deleteAccount,
          style: 'destructive',
          onPress: async () => {
            setDeleteError(null);
            try {
              await deleteAccount();
              await stopJourneyTracking();
            } catch {
              setDeleteError(copy.deleteFailed);
            }
          },
        },
      ]),
    );

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <ScrollView testID="account-screen" contentContainerStyle={styles.content}>
          <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
            {copy.title}
          </ThemedText>

          {syncError === 'auth' ? <Notice tone="danger" message={copy.authFailed} /> : null}

          <Section title={copy.profile}>
            <ListRow
              testID="account-name"
              label={copy.nameLabel}
              value={name ?? ''}
              onPress={() => guarded(() => router.push('/settings/name'))}
            />
            {memberSince ? (
              <ListRow
                testID="account-member-since"
                label={format(copy.memberSince, { date: formatDate(memberSince) })}
              />
            ) : null}
          </Section>

          <Section title={copy.checkInSettings}>
            <ListRow
              testID="account-interval"
              label={copy.intervalRow}
              value={formatInterval(intervalDays)}
              onPress={() => guarded(() => router.push('/settings/interval'))}
            />
            <ListRow
              testID="account-contacts"
              label={copy.contactsRow}
              value={plural(strings.home.contactsCount, contactCount)}
              onPress={() => router.push('/contacts')}
            />
            <ListRow
              testID="account-journey"
              label={copy.journeyRow}
              value={journeySharing ? strings.home.locationJourney : strings.home.locationOn}
              onPress={() => router.push('/settings/journey')}
            />
          </Section>

          <Section title={copy.privacy}>
            <ListRow
              testID="account-permissions"
              label={copy.permissionsRow}
              onPress={() => router.push('/settings/permissions')}
            />
            <ListRow
              testID="account-security"
              label={copy.securityRow}
              onPress={() => guarded(() => router.push('/settings/security'))}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.privacy}>
              {copy.privacyBody}
            </ThemedText>
          </Section>

          <FeatureCard>
            <ListRow testID="account-delete" label={copy.deleteAccount} destructive onPress={() => void confirmDelete()} />
          </FeatureCard>
          {deleteError ? <Notice testID="account-delete-error" tone="danger" message={deleteError} /> : null}

          <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
            {format(copy.version, { version: Constants.expoConfig?.version ?? '' })}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      <FeatureCard>
        <View>{children}</View>
      </FeatureCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  title: { fontSize: 28, lineHeight: 34 },
  section: { gap: Spacing.two },
  privacy: { paddingTop: Spacing.three },
  version: { textAlign: 'center' },
});
