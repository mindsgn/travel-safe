import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckInButton } from '@/components/check-in-button';
import { FeatureCard } from '@/components/feature-card';
import { ListRow } from '@/components/list-row';
import { Notice } from '@/components/notice';
import { PrimaryButton } from '@/components/primary-button';
import { StatusCard } from '@/components/status-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHealth } from '@/hooks/use-health';
import { useNow } from '@/hooks/use-now';
import { format, plural } from '@/i18n/format';
import { strings } from '@/i18n/strings';
import type { LatestEvent } from '@/lib/api/deadman-api';
import { formatRelativeDateTime, parseDate } from '@/lib/dates';
import type { HealthWarning } from '@/lib/device-state';
import { checkInResultMessage, pendingBannerMessage, type UserMessage } from '@/lib/home-copy';
import { formatInterval } from '@/lib/intervals';
import { guardSensitiveAction } from '@/lib/local-auth';
import { deriveHomeStatus } from '@/lib/status';
import { useAppStore } from '@/store';

const WARNING_ROUTES: Record<HealthWarning, '/contacts' | '/settings/permissions' | null> = {
  no_contacts: '/contacts',
  notifications_off: '/settings/permissions',
  location_off: '/settings/permissions',
  background_restricted: '/settings/permissions',
  low_power_mode: null,
  battery_low: null,
};

export default function HomeScreen() {
  const now = useNow();
  const name = useAppStore((state) => state.name);
  const server = useAppStore((state) => state.status);
  const fetchedAt = useAppStore((state) => state.statusFetchedAt);
  const lastSyncAt = useAppStore((state) => state.lastSyncAt);
  const pending = useAppStore((state) => state.pending);
  const intervalDays = useAppStore((state) => state.intervalDays);
  const contacts = useAppStore((state) => state.contacts);
  const journeySharing = useAppStore((state) => state.journeySharing);
  const protectCheckIn = useAppStore((state) => state.security.protectCheckIn);
  const checkingIn = useAppStore((state) => state.checkingIn);
  const syncing = useAppStore((state) => state.syncing);
  const syncError = useAppStore((state) => state.syncError);
  const checkIn = useAppStore((state) => state.checkIn);
  const sync = useAppStore((state) => state.sync);
  const [message, setMessage] = useState<UserMessage | null>(null);
  const { warnings } = useHealth(contacts.length);

  const status = deriveHomeStatus({ server, fetchedAt: parseDate(fetchedAt), pending, intervalDays, now });

  const onCheckIn = async () => {
    setMessage(null);
    if (!(await guardSensitiveAction(protectCheckIn, strings.errors.authPrompt))) {
      setMessage({ tone: 'info', message: strings.home.result.cancelledAuth });
      return;
    }
    const outcome = await checkIn();
    setMessage(checkInResultMessage(outcome, new Date()));
  };

  const lastSynced = parseDate(lastSyncAt);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <ScrollView
          testID="home-screen"
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void sync()} />}>
          <ThemedText type="subtitle" style={styles.greeting}>
            {format(strings.home.greeting, { name: name ?? '' })}
          </ThemedText>

          <StatusCard status={status} />

          {status.hasUnsyncedCheckIn ? (
            <Notice
              testID="home-pending-banner"
              tone="warning"
              message={pendingBannerMessage(status.deadline, now)}
              action={
                <PrimaryButton
                  testID="home-sync-now"
                  variant="subtle"
                  label={strings.home.syncNow}
                  loading={syncing}
                  onPress={() => void sync({ notifyConfirmed: false })}
                />
              }
            />
          ) : null}

          <CheckInButton onPress={() => void onCheckIn()} busy={checkingIn} tone={status.tone} />

          {message ? <Notice testID="home-check-in-result" tone={message.tone} message={message.message} /> : null}

          {syncError && !status.hasUnsyncedCheckIn && server ? (
            <Notice
              testID="home-offline-status"
              message={
                lastSynced
                  ? `${strings.home.offlineStatus} ${format(strings.home.lastSynced, { when: formatRelativeDateTime(lastSynced, now) })}`
                  : strings.home.offlineStatus
              }
            />
          ) : null}

          {syncError === 'auth' ? <Notice tone="danger" message={strings.account.authFailed} /> : null}

          {warnings.map((warning) => {
            const route = WARNING_ROUTES[warning];
            return (
              <Notice
                key={warning}
                testID={`health-${warning}`}
                tone={warning === 'no_contacts' ? 'danger' : 'warning'}
                message={strings.health[warning]}
                action={
                  route ? (
                    <PrimaryButton
                      testID={`health-${warning}-fix`}
                      variant="subtle"
                      label={strings.health.fix}
                      onPress={() => router.push(route)}
                    />
                  ) : undefined
                }
              />
            );
          })}

          <FeatureCard>
            <View>
              <ListRow
                testID="home-last-check-in"
                label={strings.home.lastCheckIn}
                value={status.lastCheckIn ? formatRelativeDateTime(status.lastCheckIn, now) : strings.home.never}
              />
              <ListRow
                testID="home-next-deadline"
                label={strings.home.nextDeadline}
                value={status.deadline ? formatRelativeDateTime(status.deadline, now) : strings.home.notSet}
              />
              <ListRow
                testID="home-interval"
                label={strings.home.interval}
                value={formatInterval(intervalDays)}
                onPress={() => router.push('/settings/interval')}
              />
              <ListRow
                testID="home-contacts"
                label={strings.home.contacts}
                value={contacts.length > 0 ? plural(strings.home.contactsCount, contacts.length) : strings.home.contactsNone}
                onPress={() => router.push('/contacts')}
              />
              <ListRow
                testID="home-location"
                label={strings.home.location}
                value={
                  warnings.includes('location_off')
                    ? strings.home.locationOff
                    : journeySharing
                      ? strings.home.locationJourney
                      : strings.home.locationOn
                }
                onPress={() => router.push('/settings/journey')}
              />
            </View>
          </FeatureCard>

          {server?.latest_event ? <LatestEventCard event={server.latest_event} now={now} /> : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function LatestEventCard({ event, now }: { event: LatestEvent; now: Date }) {
  const resolvedAt = parseDate(event.resolved_at);
  return (
    <FeatureCard testID="home-latest-event" title={strings.home.eventTitle}>
      {resolvedAt ? (
        <ThemedText type="small">
          {format(strings.home.eventResolved, { when: formatRelativeDateTime(resolvedAt, now) })}
        </ThemedText>
      ) : null}
      {event.notifications.map((notification) => (
        <ListRow
          key={notification.id}
          testID={`event-notification-${notification.id}`}
          label={notification.recipient_name}
          hint={strings.home.channel[notification.channel]}
          value={strings.home.notificationStatus[notification.status]}
        />
      ))}
    </FeatureCard>
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
  greeting: { fontSize: 28, lineHeight: 34 },
});
