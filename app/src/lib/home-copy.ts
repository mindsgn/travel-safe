import { format } from '@/i18n/format';
import { strings } from '@/i18n/strings';
import type { CheckInOutcome } from '@/lib/check-in-service';
import { formatRelativeDateTime, parseDate } from '@/lib/dates';
import { formatDuration } from '@/lib/intervals';
import type { HomeStatus } from '@/lib/status';

export type MessageTone = 'success' | 'warning' | 'danger' | 'info';
export type UserMessage = { tone: MessageTone; message: string };

export function describeHomeStatus(status: HomeStatus): { title: string; body: string } {
  const remaining = formatDuration(status.remainingMs ?? 0);
  return {
    title: strings.home.tone[status.tone],
    body: format(strings.home.toneBody[status.tone], { remaining }),
  };
}

/**
 * The only path that says "checked in" is a server-confirmed check-in. Everything else
 * says plainly that it is saved on the phone and has not reached the server.
 */
export function checkInResultMessage(outcome: CheckInOutcome, now: Date): UserMessage {
  switch (outcome.kind) {
    case 'synced': {
      const deadline = parseDate(outcome.response.status.next_deadline_at);
      const when = deadline ? formatRelativeDateTime(deadline, now) : '';
      const template = outcome.locationIncluded ? strings.home.result.synced : strings.home.result.syncedNoLocation;
      return { tone: 'success', message: format(template, { deadline: when }) };
    }
    case 'local':
      return {
        tone: 'warning',
        message: outcome.reason === 'auth' ? strings.home.result.localAuth : strings.home.result.localOffline,
      };
    case 'rejected':
      return { tone: 'danger', message: strings.home.result.rejected };
  }
}

export function pendingBannerMessage(deadline: Date | null, now: Date): string {
  const when = deadline ? formatRelativeDateTime(deadline, now) : strings.home.notSet;
  return format(strings.home.pendingBanner, { deadline: when });
}
