import { Platform } from 'react-native';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';
const ANDROID_EMULATOR_API_BASE_URL = 'http://10.0.2.2:8000';

export function trimEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function defaultApiBaseUrl(os: typeof Platform.OS = Platform.OS): string {
  return os === 'android' ? ANDROID_EMULATOR_API_BASE_URL : DEFAULT_API_BASE_URL;
}

export function getApiBaseUrl(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  os: typeof Platform.OS = Platform.OS,
): string {
  const configured = trimEnv(env.EXPO_PUBLIC_API_BASE_URL);
  return configured.replace(/\/+$/, '') || defaultApiBaseUrl(os);
}

export function getMapboxToken(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  return trimEnv(env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);
}
