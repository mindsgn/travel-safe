import { callingCodeForRegion, detectCallingCode, regionFromLocale } from './phone-region';

describe('phone region', () => {
  it('maps ISO regions to calling codes', () => {
    expect(callingCodeForRegion('za')).toBe('27');
    expect(callingCodeForRegion('US')).toBe('1');
    expect(callingCodeForRegion('XX')).toBeUndefined();
    expect(callingCodeForRegion(null)).toBeUndefined();
  });

  it('extracts the region from a locale', () => {
    expect(regionFromLocale('en-ZA')).toBe('ZA');
    expect(regionFromLocale('en_GB')).toBe('GB');
    expect(regionFromLocale('en')).toBeUndefined();
  });

  it('prefers the SIM country', async () => {
    await expect(
      detectCallingCode({ simCountry: async () => 'gb', locale: () => 'en-ZA' }),
    ).resolves.toBe('44');
  });

  it('falls back to the locale when the SIM is unavailable', async () => {
    await expect(detectCallingCode({ simCountry: async () => null, locale: () => 'en-ZA' })).resolves.toBe('27');
    await expect(
      detectCallingCode({
        simCountry: async () => {
          throw new Error('no sim');
        },
        locale: () => 'en-KE',
      }),
    ).resolves.toBe('254');
  });
});
