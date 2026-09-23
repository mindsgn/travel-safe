import { chunk, createJsonStore, createMemoryBackend, CHUNK_SIZE } from './secure-storage';

describe('secure JSON store', () => {
  it('round-trips values', async () => {
    const store = createJsonStore(createMemoryBackend());
    await store.set('profile', { name: 'Thandi', interval: 7 });
    await expect(store.get('profile')).resolves.toEqual({ name: 'Thandi', interval: 7 });
  });

  it('returns null for missing keys', async () => {
    await expect(createJsonStore(createMemoryBackend()).get('nope')).resolves.toBeNull();
  });

  it('splits large values into chunks under the SecureStore size limit', async () => {
    const backend = createMemoryBackend();
    const store = createJsonStore(backend);
    const big = { text: 'x'.repeat(CHUNK_SIZE * 2 + 10) };
    await store.set('big', big);
    expect(backend.data.get('big.count')).toBe('3');
    for (const value of backend.data.values()) expect(value.length).toBeLessThanOrEqual(CHUNK_SIZE);
    await expect(store.get('big')).resolves.toEqual(big);
  });

  it('removes stale chunks when a value shrinks', async () => {
    const backend = createMemoryBackend();
    const store = createJsonStore(backend);
    await store.set('k', 'x'.repeat(CHUNK_SIZE * 3));
    await store.set('k', 'small');
    expect(backend.data.has('k.1')).toBe(false);
    await expect(store.get('k')).resolves.toBe('small');
  });

  it('removes every chunk', async () => {
    const backend = createMemoryBackend();
    const store = createJsonStore(backend);
    await store.set('k', 'x'.repeat(CHUNK_SIZE * 2));
    await store.remove('k');
    expect(backend.data.size).toBe(0);
  });

  it('treats corrupt or partial data as missing', async () => {
    const backend = createMemoryBackend({ 'a.count': '1', 'a.0': '{oops', 'b.count': '2', 'b.0': '"x' });
    const store = createJsonStore(backend);
    await expect(store.get('a')).resolves.toBeNull();
    await expect(store.get('b')).resolves.toBeNull();
  });

  it('chunks strings', () => {
    expect(chunk('abcde', 2)).toEqual(['ab', 'cd', 'e']);
    expect(chunk('', 2)).toEqual(['']);
  });
});
