import * as Linking from 'expo-linking';

import { normalizePhoneNumber } from '@/lib/trusted-contacts';

export type OpenUrl = (url: string) => Promise<unknown>;

export type DeliverAlertInput = {
  phones: string[];
  body: string;
  openUrl?: OpenUrl;
};

export type DeliveryResult = { attempted: number; succeeded: number };

export function buildSmsUri(phone: string, body: string): string | null {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;
  return `sms:${normalized}?&body=${encodeURIComponent(body)}`;
}

export async function deliverSosAlert(input: DeliverAlertInput): Promise<DeliveryResult> {
  return deliverToPhones(input);
}

export async function deliverLiveUpdate(input: DeliverAlertInput): Promise<DeliveryResult> {
  return deliverToPhones(input);
}

async function deliverToPhones(input: DeliverAlertInput): Promise<DeliveryResult> {
  const { phones, body, openUrl = Linking.openURL } = input;
  let attempted = 0;
  let succeeded = 0;
  for (const phone of phones) {
    const uri = buildSmsUri(phone, body);
    if (!uri) continue;
    attempted += 1;
    try {
      await openUrl(uri);
      succeeded += 1;
    } catch {
      // A recipient couldn't be reached; continue to the next one.
    }
  }
  return { attempted, succeeded };
}