import { createSqliteDeviceCodeStore, ensureDeviceIdentityTable, type SqliteLike } from './device-identity-sqlite';

jest.mock('@/db/client', () => ({
  expo_sqlite: {
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  },
}));

function createFakeSqlite(existing: { code: string } | null = null): SqliteLike & { rows: { code: string } | null } {
  const fake = {
    rows: existing,
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => fake.rows),
    runSync: jest.fn((_sql: string, params?: unknown[]) => {
      fake.rows = { code: String(params?.[0]) };
    }),
  };
  return fake;
}

describe('sqlite device code store', () => {
  it('creates the identity table', () => {
    const db = createFakeSqlite();
    ensureDeviceIdentityTable(db);
    expect(db.execSync).toHaveBeenCalled();
  });

  it('reads and writes the saved code', () => {
    const db = createFakeSqlite();
    const store = createSqliteDeviceCodeStore(db);
    expect(store.get()).toBeNull();
    store.set('TS-ABCDEFGH');
    expect(store.get()).toBe('TS-ABCDEFGH');
  });
});
