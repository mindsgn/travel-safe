import * as Cellular from 'expo-cellular';

/**
 * expo-cellular is used only for the SIM's ISO country code, which needs no runtime
 * permission. It lets us turn a local number like 082… into +27 82… for contacts.
 */
const CALLING_CODES: Record<string, string> = {
  AE: '971', AR: '54', AT: '43', AU: '61', BE: '32', BR: '55', BW: '267', CA: '1', CH: '41',
  CN: '86', DE: '49', DK: '45', EG: '20', ES: '34', FI: '358', FR: '33', GB: '44', GH: '233',
  GR: '30', HK: '852', IE: '353', IL: '972', IN: '91', IT: '39', JP: '81', KE: '254', KR: '82',
  LS: '266', MA: '212', MU: '230', MW: '265', MX: '52', MZ: '258', NA: '264', NG: '234', NL: '31',
  NO: '47', NZ: '64', PL: '48', PT: '351', SA: '966', SE: '46', SG: '65', SZ: '268', TR: '90',
  TZ: '255', UG: '256', US: '1', ZA: '27', ZM: '260', ZW: '263',
};

export function callingCodeForRegion(region: string | null | undefined): string | undefined {
  return region ? CALLING_CODES[region.toUpperCase()] : undefined;
}

export function regionFromLocale(locale: string | null | undefined): string | undefined {
  const match = locale?.match(/[-_]([A-Za-z]{2})(?:$|[-_@])/);
  return match ? match[1].toUpperCase() : undefined;
}

export type RegionSources = {
  simCountry: () => Promise<string | null>;
  locale: () => string | undefined;
};

const defaultSources: RegionSources = {
  simCountry: () => Cellular.getIsoCountryCodeAsync(),
  locale: () => Intl.DateTimeFormat().resolvedOptions().locale,
};

export async function detectCallingCode(sources: RegionSources = defaultSources): Promise<string | undefined> {
  try {
    const fromSim = callingCodeForRegion(await sources.simCountry());
    if (fromSim) return fromSim;
  } catch {
    // Some devices (e.g. no SIM, iOS 16+) report nothing; fall back to the locale.
  }
  return callingCodeForRegion(regionFromLocale(sources.locale()));
}
