import { strings } from '@/i18n/strings';
import { metersBetween } from '@/lib/location';

export const SOS_COUNTDOWN_SECONDS = 5;
export const SOS_LOCATION_UPDATE_INTERVAL_MS = 15_000;
export const SOS_MIN_MOVEMENT_METERS = 25;

export type EmergencyPhase = 'idle' | 'counting' | 'active' | 'ended';

export type EmergencyPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestamp: number;
};

export function countdownRemainingMs(endAt: number, now: number): number {
  return Math.max(0, endAt - now);
}

export function createEmergencyId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `emg_${Date.now().toString(36)}_${random}`;
}

export function formatAccuracy(accuracyMeters: number | null | undefined): string | null {
  if (accuracyMeters == null || !Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return null;
  }
  if (accuracyMeters < 1) return '±<1 m';
  return `±${Math.round(accuracyMeters)} m`;
}

export function mapsLinkForPosition(position: Pick<EmergencyPosition, 'latitude' | 'longitude'>): string {
  return `${position.latitude},${position.longitude}`;
}

export function formatStartedAt(startedAt: number | Date): string {
  return new Date(startedAt).toISOString();
}

export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function buildSosAlertBody(input: {
  appName: string;
  position?: EmergencyPosition | null;
  startedAt: number | Date;
}): string {
  const { appName, position, startedAt } = input;
  return interpolate(strings.emergency.send.alertBody, {
    appName,
    location: position ? mapsLinkForPosition(position) : 'Unavailable',
    accuracy: accuracySuffix(position?.accuracyMeters),
    startedAt: formatStartedAt(startedAt),
  });
}

export function buildSosUpdateBody(input: {
  appName: string;
  position: EmergencyPosition;
  startedAt: number | Date;
}): string {
  const { appName, position, startedAt } = input;
  return interpolate(strings.emergency.send.updateBody, {
    appName,
    location: mapsLinkForPosition(position),
    accuracy: accuracySuffix(position.accuracyMeters),
    startedAt: formatStartedAt(startedAt),
  });
}

export function buildAlertStatusText(input: {
  recipientCount: number;
  alertSent: boolean;
  hasRecipients: boolean;
}): string {
  const { recipientCount, alertSent, hasRecipients } = input;
  if (!hasRecipients) return strings.emergency.active.alertSentNoRecipients;
  if (!alertSent) return strings.emergency.active.alertFailed;
  const template =
    recipientCount === 1
      ? strings.emergency.active.alertSentOne
      : strings.emergency.active.alertSentMany;
  return interpolate(template, { count: String(recipientCount) });
}

export function shouldUpdateLocation(input: {
  now: number;
  lastSentAt: number | null;
  lastSharedPosition: EmergencyPosition | null;
  currentPosition: EmergencyPosition;
  intervalMs: number;
  minMovementMeters: number;
}): boolean {
  const { now, lastSentAt, lastSharedPosition, currentPosition, intervalMs, minMovementMeters } = input;
  if (lastSentAt == null) return true;
  if (now - lastSentAt < intervalMs) return false;
  if (lastSharedPosition == null) return true;
  return metersBetween(lastSharedPosition, currentPosition) >= minMovementMeters;
}

function accuracySuffix(accuracyMeters: number | null | undefined): string {
  const formatted = formatAccuracy(accuracyMeters);
  return formatted ? ` (accuracy ${formatted})` : ' (accuracy unknown)';
}