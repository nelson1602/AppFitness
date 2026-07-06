import type { SQLiteDatabase } from 'expo-sqlite';

import { initialMigration } from './001-initial';

export interface Migration {
  version: number;
  name: string;
  statements: readonly string[];
}

/**
 * Ordered migration registry. Append new migrations here — never edit a
 * shipped migration (.ai/04_DATABASE.md).
 */
export const MIGRATIONS: readonly Migration[] = [initialMigration];

/**
 * Applies pending migrations atomically, tracked via PRAGMA user_version
 * plus a `migrations` audit table (version, name, applied_at).
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`CREATE TABLE IF NOT EXISTS migrations (
    version    INTEGER PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    await db.withExclusiveTransactionAsync(async (tx) => {
      for (const statement of migration.statements) {
        await tx.execAsync(statement);
      }
      await tx.runAsync('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        migration.version,
        migration.name,
        new Date().toISOString(),
      ]);
      await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
