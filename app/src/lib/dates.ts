import { format } from '@/i18n/format';
import { strings } from '@/i18n/strings';

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatTime(date: Date, locale?: string): string {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** "today at 14:05", "tomorrow at 09:00", or "Mon, 12 Jan 2026 at 09:00". */
export function formatRelativeDateTime(date: Date, now: Date, locale?: string): string {
  const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  const time = formatTime(date, locale);
  if (dayDiff === 0) return format(strings.relative.today, { time });
  if (dayDiff === 1) return format(strings.relative.tomorrow, { time });
  if (dayDiff === -1) return format(strings.relative.yesterday, { time });
  return format(strings.relative.other, { date: formatDate(date, locale), time });
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
