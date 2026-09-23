import { plural } from '@/i18n/format';
import { strings } from '@/i18n/strings';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 365;
export const DEFAULT_INTERVAL_DAYS = 7;
export const INTERVAL_PRESETS = [1, 2, 3, 7, 14, 30, 60, 90, 180, 365] as const;

export function isValidInterval(days: number): boolean {
  return Number.isInteger(days) && days >= MIN_INTERVAL_DAYS && days <= MAX_INTERVAL_DAYS;
}

export function intervalMs(days: number): number {
  return days * DAY_MS;
}

export function computeDeadline(lastCheckIn: Date, intervalDays: number): Date {
  if (!isValidInterval(intervalDays)) throw new RangeError(`Invalid interval: ${intervalDays}`);
  return new Date(lastCheckIn.getTime() + intervalMs(intervalDays));
}

/** Mirrors the backend rule: a check-in exactly at the deadline is on time. */
export function isExpired(deadline: Date | null, now: Date): boolean {
  return deadline !== null && now.getTime() > deadline.getTime();
}

export function formatInterval(days: number): string {
  const preset = strings.intervals.presets[String(days) as keyof typeof strings.intervals.presets];
  if (preset) return preset;
  if (days % 365 === 0) return plural(strings.units.year, days / 365);
  if (days % 7 === 0) return plural(strings.units.week, days / 7);
  return plural(strings.units.day, days);
}

/** Human duration using the two largest units, e.g. "2 days 3 hours". */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < MINUTE_MS) return strings.units.lessThanMinute;
  const days = Math.floor(safe / DAY_MS);
  const hours = Math.floor((safe % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((safe % HOUR_MS) / MINUTE_MS);
  const parts: string[] = [];
  if (days > 0) parts.push(plural(strings.units.day, days));
  if (hours > 0) parts.push(plural(strings.units.hour, hours));
  if (days === 0 && minutes > 0) parts.push(plural(strings.units.minute, minutes));
  return parts.slice(0, 2).join(' ');
}
