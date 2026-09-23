import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { format } from '@/i18n/format';
import { strings } from '@/i18n/strings';
import { formatRelativeDateTime } from '@/lib/dates';
import { computeReminderSchedule, type ReminderKind } from '@/lib/reminders';

export const CHANNEL_ID = 'check-ins';
const REMINDER_KINDS: readonly ReminderKind[] = ['reminder', 'final', 'expired'];

export function reminderIdentifier(kind: ReminderKind): string {
  return `deadline-${kind}`;
}

export type NotificationsApi = Pick<
  typeof Notifications,
  | 'scheduleNotificationAsync'
  | 'cancelScheduledNotificationAsync'
  | 'setNotificationHandler'
  | 'setNotificationChannelAsync'
>;

export function buildReminderContent(
  kind: ReminderKind,
  deadline: Date,
  firesAt: Date,
): { title: string; body: string } {
  const when = formatRelativeDateTime(deadline, firesAt);
  const copy = strings.notifications[kind];
  return { title: copy.title, body: format(copy.body, { when }) };
}

export async function configureNotifications(api: NotificationsApi = Notifications): Promise<void> {
  api.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await api.setNotificationChannelAsync(CHANNEL_ID, {
      name: strings.notifications.channelName,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function cancelDeadlineReminders(api: NotificationsApi = Notifications): Promise<void> {
  await Promise.all(
    REMINDER_KINDS.map((kind) => api.cancelScheduledNotificationAsync(reminderIdentifier(kind)).catch(() => undefined)),
  );
}

/**
 * Local notifications are delivered by the OS even when the app is not running, so
 * reminders don't depend on background JavaScript. Fixed identifiers make rescheduling
 * replace rather than duplicate.
 */
export async function scheduleDeadlineReminders(
  deadline: Date,
  intervalDays: number,
  now: Date,
  api: NotificationsApi = Notifications,
): Promise<number> {
  await cancelDeadlineReminders(api);
  const schedule = computeReminderSchedule(deadline, intervalDays, now);
  for (const reminder of schedule) {
    await api.scheduleNotificationAsync({
      identifier: reminderIdentifier(reminder.kind),
      content: {
        ...buildReminderContent(reminder.kind, deadline, reminder.fireAt),
        data: { kind: reminder.kind, url: '/' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.fireAt,
        channelId: CHANNEL_ID,
      },
    });
  }
  return schedule.length;
}

/** Shown when a check-in saved offline later reaches the server. */
export async function notifyCheckInSynced(
  deadline: Date,
  now: Date,
  api: NotificationsApi = Notifications,
): Promise<void> {
  await api.scheduleNotificationAsync({
    content: {
      title: strings.notifications.synced.title,
      body: format(strings.notifications.synced.body, { when: formatRelativeDateTime(deadline, now) }),
    },
    trigger: null,
  });
}
