import { Platform } from 'react-native';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';
const ANDROID_EMULATOR_API_BASE_URL = 'http://10.0.2.2:8000';
const HOUR_MS = 3_600_000;

type Env = Record<string, string | undefined>;

// Expo only inlines EXPO_PUBLIC_* variables when accessed statically, so read them here.
const publicEnv: Env = {
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_REMINDER_OFFSETS_HOURS: process.env.EXPO_PUBLIC_REMINDER_OFFSETS_HOURS,
};

export function trimEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function defaultApiBaseUrl(os: typeof Platform.OS = Platform.OS): string {
  return os === 'android' ? ANDROID_EMULATOR_API_BASE_URL : DEFAULT_API_BASE_URL;
}

export function getApiBaseUrl(env: Env = publicEnv, os: typeof Platform.OS = Platform.OS): string {
  const configured = trimEnv(env.EXPO_PUBLIC_API_BASE_URL);
  return configured.replace(/\/+$/, '') || defaultApiBaseUrl(os);
}

/**
 * Reminder offsets before the deadline, e.g. "24,2" = a reminder 24h before and a final
 * warning 2h before. Returns null when unset or malformed so defaults apply.
 */
export function getReminderOffsetsMs(env: Env = publicEnv): { reminder: number; final: number } | null {
  const raw = trimEnv(env.EXPO_PUBLIC_REMINDER_OFFSETS_HOURS);
  if (!raw) return null;
  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part) || part <= 0)) return null;
  const [reminder, final] = parts;
  if (final >= reminder) return null;
  return { reminder: reminder * HOUR_MS, final: final * HOUR_MS };
}
