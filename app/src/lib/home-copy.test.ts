import type { CheckInResponse } from './api/deadman-api';
import { checkInResultMessage, describeHomeStatus, pendingBannerMessage } from './home-copy';
import { HOUR_MS } from './intervals';

const NOW = new Date('2026-01-10T09:00:00');

const response = {
  status: { next_deadline_at: new Date('2026-01-11T09:00:00').toISOString() },
} as unknown as CheckInResponse;

describe('checkInResultMessage', () => {
  it('confirms a server-synchronized check-in with the new deadline', () => {
    const message = checkInResultMessage({ kind: 'synced', response, locationIncluded: true }, NOW);
    expect(message.tone).toBe('success');
    expect(message.message).toContain('Checked in');
    expect(message.message).toContain('tomorrow');
  });

  it('mentions when location could not be included', () => {
    const message = checkInResultMessage({ kind: 'synced', response, locationIncluded: false }, NOW);
    expect(message.message).toContain('without location');
  });

  it('never claims the server received a local-only check-in', () => {
    for (const reason of ['offline', 'auth'] as const) {
      const message = checkInResultMessage({ kind: 'local', reason }, NOW);
      expect(message.tone).toBe('warning');
      expect(message.message).toContain('Saved on this phone');
      expect(message.message).not.toMatch(/^Checked in/);
    }
  });

  it('explains a rejected check-in did not move the deadline', () => {
    const message = checkInResultMessage({ kind: 'rejected' }, NOW);
    expect(message.tone).toBe('danger');
    expect(message.message).toContain('has not changed');
  });
});

describe('describeHomeStatus', () => {
  it('uses the remaining time in the body', () => {
    const copy = describeHomeStatus({
      tone: 'due_soon',
      deadline: null,
      lastCheckIn: null,
      remainingMs: 3 * HOUR_MS,
      hasUnsyncedCheckIn: false,
    });
    expect(copy.title).toBe('Check-in due soon');
    expect(copy.body).toContain('3 hours');
  });
});

describe('pendingBannerMessage', () => {
  it('warns that contacts could still be notified at the server deadline', () => {
    expect(pendingBannerMessage(new Date('2026-01-10T18:00:00'), NOW)).toContain('today at');
    expect(pendingBannerMessage(null, NOW)).toContain('Not set');
  });
});
