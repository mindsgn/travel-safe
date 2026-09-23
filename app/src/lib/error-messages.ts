import { strings } from '@/i18n/strings';
import { ApiError, isNetworkError } from '@/lib/api/client';
import type { ContactErrorCode } from '@/lib/contacts';

const CONTACT_FIELD_CODES: readonly string[] = [
  'missing_name',
  'name_too_long',
  'invalid_email',
  'invalid_phone',
  'missing_channel',
  'whatsapp_requires_phone',
  'duplicate_contact',
  'contact_limit',
];

export function contactErrorText(code: ContactErrorCode | 'duplicate_contact' | 'contact_limit'): string {
  return strings.contacts.form.errors[code];
}

export function contactSaveErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return strings.contacts.form.errors.offline;
  if (error instanceof ApiError && error.code && CONTACT_FIELD_CODES.includes(error.code)) {
    return contactErrorText(error.code as Parameters<typeof contactErrorText>[0]);
  }
  return strings.contacts.form.errors.server;
}

export function intervalErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return strings.settings.interval.offline;
  if (error instanceof ApiError && error.code === 'interval_would_expire') return strings.settings.interval.wouldExpire;
  return strings.settings.interval.failed;
}

export function registrationErrorMessage(error: unknown): string {
  return isNetworkError(error) ? strings.onboarding.name.failedOffline : strings.onboarding.name.failedServer;
}
