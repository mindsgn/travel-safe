import { expo_sqlite } from '@/db/client';

import type { DeviceCodeStore } from '@/lib/device-identity';

export type SqliteLike = {
  execSync: (sql: string) => void;
  getFirstSync: <T>(sql: string, params?: unknown[]) => T | null;
  runSync: (sql: string, params?: unknown[]) => void;
};

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS device_identity (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`;

export function ensureDeviceIdentityTable(database: SqliteLike): void {
  database.execSync(CREATE_SQL);
}

export function createSqliteDeviceCodeStore(database: SqliteLike): DeviceCodeStore {
  ensureDeviceIdentityTable(database);
  return {
    get() {
      const row = database.getFirstSync<{ code: string }>(
        "SELECT code FROM device_identity WHERE id = 'self' LIMIT 1",
      );
      return row?.code ?? null;
    },
    set(code: string) {
      database.runSync(
        "INSERT OR REPLACE INTO device_identity (id, code, created_at) VALUES ('self', ?, ?)",
        [code, Date.now()],
      );
    },
  };
}

export const sqliteDeviceCodeStore = createSqliteDeviceCodeStore(expo_sqlite);
