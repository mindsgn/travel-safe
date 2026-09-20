import {
  createDeviceCode,
  createMemoryDeviceCodeStore,
  isDeviceCode,
  loadOrCreateDeviceCode,
  randomDeviceToken,
} from './device-identity';

describe('device identity', () => {
  it('builds an eight-character token and a TS code', () => {
    const token = randomDeviceToken(() => 0);
    expect(token).toHaveLength(8);
    const code = createDeviceCode(() => 0);
    expect(isDeviceCode(code)).toBe(true);
    expect(code.startsWith('TS-')).toBe(true);
  });

  it('rejects malformed codes', () => {
    expect(isDeviceCode('nope')).toBe(false);
    expect(isDeviceCode('TS-short')).toBe(false);
    expect(isDeviceCode(null)).toBe(false);
  });

  it('reuses a stored code and creates one when missing', () => {
    const existing = createMemoryDeviceCodeStore('TS-ABCDEFGH');
    expect(loadOrCreateDeviceCode(existing)).toBe('TS-ABCDEFGH');

    const empty = createMemoryDeviceCodeStore();
    const created = loadOrCreateDeviceCode(empty, () => 'TS-NEWCODE1');
    expect(created).toBe('TS-NEWCODE1');
    expect(empty.get()).toBe('TS-NEWCODE1');
  });
});
