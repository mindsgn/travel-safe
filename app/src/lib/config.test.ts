import { defaultApiBaseUrl, getApiBaseUrl, getReminderOffsetsMs, trimEnv } from './config';

describe('config', () => {
  it('trims env values', () => {
    expect(trimEnv('  abc  ')).toBe('abc');
    expect(trimEnv(undefined)).toBe('');
  });

  it('uses a platform-aware default API base URL when unset', () => {
    expect(getApiBaseUrl({}, 'ios')).toBe('http://127.0.0.1:8000');
    expect(getApiBaseUrl({}, 'android')).toBe('http://10.0.2.2:8000');
    expect(defaultApiBaseUrl('web')).toBe('http://127.0.0.1:8000');
  });

  it('strips trailing slashes from the API base URL', () => {
    expect(getApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com/' })).toBe(
      'https://api.example.com',
    );
  });

  it('parses reminder offsets in hours', () => {
    expect(getReminderOffsetsMs({ EXPO_PUBLIC_REMINDER_OFFSETS_HOURS: '12, 1' })).toEqual({
      reminder: 12 * 3_600_000,
      final: 3_600_000,
    });
  });

  it('ignores unset or malformed reminder offsets', () => {
    expect(getReminderOffsetsMs({})).toBeNull();
    expect(getReminderOffsetsMs({ EXPO_PUBLIC_REMINDER_OFFSETS_HOURS: 'soon' })).toBeNull();
    expect(getReminderOffsetsMs({ EXPO_PUBLIC_REMINDER_OFFSETS_HOURS: '1,2' })).toBeNull();
    expect(getReminderOffsetsMs({ EXPO_PUBLIC_REMINDER_OFFSETS_HOURS: '24,-1' })).toBeNull();
  });
});
