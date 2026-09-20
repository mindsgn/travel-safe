import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

export const DATABASE_NAME = "amafa.db";

export const expo_sqlite = openDatabaseSync(DATABASE_NAME);
// Ensure ON DELETE CASCADE on components works (off by default in SQLite).
expo_sqlite.execSync("PRAGMA foreign_keys = ON;");
export const db = drizzle(expo_sqlite);
