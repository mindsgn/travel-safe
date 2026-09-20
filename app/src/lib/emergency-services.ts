import * as Linking from 'expo-linking';

import { strings } from '@/i18n/strings';

export const EMERGENCY_SERVICE_IDS = [
  'general',
  'police',
  'medical',
  'fire',
  'capeTown',
  'er24',
  'netcare',
  'nsri',
  'wilderness',
  'poison',
  'childline',
  'gbv',
  'crimeStop',
  'traffic',
] as const;

export type EmergencyServiceId = (typeof EMERGENCY_SERVICE_IDS)[number];

const EMERGENCY_SERVICE_NUMBERS: Record<EmergencyServiceId, string> = {
  general: '112',
  police: '10111',
  medical: '10177',
  fire: '112',
  capeTown: '021 480 7700',
  er24: '084 124',
  netcare: '082 911',
  nsri: '087 094 9774',
  wilderness: '021 937 0300',
  poison: '0861 555 777',
  childline: '116',
  gbv: '0800 428 428',
  crimeStop: '08600 10111',
  traffic: '0861 400 800',
};

export type EmergencyService = {
  id: EmergencyServiceId;
  name: string;
  number: string;
  hint: string;
};

export const EMERGENCY_SERVICES: EmergencyService[] = EMERGENCY_SERVICE_IDS.map((id) => ({
  id,
  name: strings.emergency.services.details[id].name,
  number: EMERGENCY_SERVICE_NUMBERS[id],
  hint: strings.emergency.services.details[id].hint,
}));

export type OpenUrl = (url: string) => Promise<unknown>;

const TEL_STRIP_REGEX = /[\s\-()./]/g;
const MIN_TEL_DIGITS = 3;

export function buildTelUri(number: string): string | null {
  const cleaned = number.replace(TEL_STRIP_REGEX, '').trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < MIN_TEL_DIGITS) return null;
  return `tel:${cleaned}`;
}

export async function callEmergencyService(
  number: string,
  openUrl: OpenUrl = Linking.openURL,
): Promise<boolean> {
  const uri = buildTelUri(number);
  if (!uri) return false;
  try {
    await openUrl(uri);
    return true;
  } catch {
    return false;
  }
}