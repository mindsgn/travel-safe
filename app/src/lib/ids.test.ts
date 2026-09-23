import { createClientId } from './ids';

describe('createClientId', () => {
  it('matches the backend client_id format', () => {
    expect(createClientId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('is unique across calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createClientId()));
    expect(ids.size).toBe(200);
  });

  it('is deterministic with injected time and randomness', () => {
    expect(createClientId(new Date(0), () => 0)).toBe('ci_0_aaaaaaaaaaaaaaaa');
  });
});
