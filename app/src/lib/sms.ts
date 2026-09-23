import * as SMS from 'expo-sms';

import { format } from '@/i18n/format';
import { strings } from '@/i18n/strings';

export type SmsApi = Pick<typeof SMS, 'isAvailableAsync' | 'sendSMSAsync'>;
export type SmsOutcome = 'sent' | 'cancelled' | 'unavailable' | 'unknown';

export function buildInviteMessage(userName: string): string {
  return format(strings.contacts.invite.message, { name: userName });
}

/**
 * Opens the system composer pre-filled; the user must press Send. expo-sms cannot send
 * silently, so automated alerts go through the backend instead.
 */
export async function inviteContactBySms(phone: string, userName: string, api: SmsApi = SMS): Promise<SmsOutcome> {
  if (!(await api.isAvailableAsync())) return 'unavailable';
  try {
    const { result } = await api.sendSMSAsync([phone], buildInviteMessage(userName));
    return result === 'sent' || result === 'cancelled' ? result : 'unknown';
  } catch {
    return 'unknown';
  }
}
