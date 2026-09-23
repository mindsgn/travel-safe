import { DAY_MS, HOUR_MS } from './intervals';
import {
  buildReminderContent,
  cancelDeadlineReminders,
  configureNotifications,
  notifyCheckInSynced,
  reminderIdentifier,
  scheduleDeadlineReminders,
  type NotificationsApi,
} from './notifications';

function fakeApi() {
  return {
    scheduleNotificationAsync: jest.fn(async (_request: unknown) => 'id'),
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
  };
}

const NOW = new Date('2026-01-10T09:00:00Z');

describe('notifications', () => {
  it('schedules reminder, final warning and deadline notifications', async () => {
    const api = fakeApi();
    const deadline = new Date(NOW.getTime() + 7 * DAY_MS);
    const count = await scheduleDeadlineReminders(deadline, 7, NOW, api as unknown as NotificationsApi);
    expect(count).toBe(3);
    const calls = api.scheduleNotificationAsync.mock.calls.map(([request]) => request as never as {
      identifier: string;
      trigger: { date: Date };
    });
    expect(calls.map((call) => call.identifier)).toEqual([
      'deadline-reminder',
      'deadline-final',
      'deadline-expired',
    ]);
    expect(calls[0].trigger.date.getTime()).toBe(deadline.getTime() - 24 * HOUR_MS);
  });

  it('cancels old reminders before rescheduling so they never duplicate', async () => {
    const api = fakeApi();
    await scheduleDeadlineReminders(new Date(NOW.getTime() + DAY_MS), 1, NOW, api as unknown as NotificationsApi);
    const cancelOrder = api.cancelScheduledNotificationAsync.mock.invocationCallOrder[0];
    const scheduleOrder = api.scheduleNotificationAsync.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(scheduleOrder);
    expect(api.cancelScheduledNotificationAsync).toHaveBeenCalledWith(reminderIdentifier('final'));
  });

  it('tells the user what happens if they do not check in', () => {
    const content = buildReminderContent('reminder', new Date(NOW.getTime() + DAY_MS), NOW);
    expect(content.title).toBe('Check in required');
    expect(content.body).toContain('tomorrow');
    expect(content.body).toContain('prevent your emergency contacts from being notified');
  });

  it('confirms when an offline check-in is synchronized', async () => {
    const api = fakeApi();
    await notifyCheckInSynced(new Date(NOW.getTime() + DAY_MS), NOW, api as unknown as NotificationsApi);
    expect(api.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: null, content: expect.objectContaining({ title: 'Check-in confirmed' }) }),
    );
  });

  it('configures the foreground handler and survives cancel failures', async () => {
    const api = fakeApi();
    await configureNotifications(api as unknown as NotificationsApi);
    expect(api.setNotificationHandler).toHaveBeenCalled();
    api.cancelScheduledNotificationAsync.mockRejectedValue(new Error('none'));
    await expect(cancelDeadlineReminders(api as unknown as NotificationsApi)).resolves.toBeUndefined();
  });
});
