// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test.
import { DatabaseSync } from 'node:sqlite';

import { WELLNESS_AFFECTED_AREAS } from '@/features/wellness/domain/wellness-safety-profile';

import { wellnessInjuryAreasMigration } from './008-wellness-injury-areas';
import { MIGRATIONS } from './index';

/** v8 Block 2 — the injury-area vocabulary widens; every older row stays valid. */
function migrated(upTo: number): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS.filter((m) => m.version <= upTo)) {
    for (const statement of migration.statements) db.exec(statement);
  }
  db.prepare(
    "INSERT INTO local_user (id, email, username, created_at, updated_at) VALUES ('u1','u@x.test','u','2026-10-26','2026-10-26')",
  ).run();
  return db;
}

function insert(db: DatabaseSync, id: string, areas: readonly string[]): { ok: boolean } {
  try {
    db.prepare(
      `INSERT INTO wellness_safety_profiles
         (id, user_id, created_at, updated_at, evaluation_completed, evaluation_date,
          affected_areas, movements_to_avoid, deleted_at)
       VALUES (?, 'u1', '2026-10-26', '2026-10-26', 0, NULL, ?, '[]', '2026-10-26')`,
    ).run(id, JSON.stringify(areas));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

describe('migration 008 — wellness injury areas', () => {
  it('is registered eighth', () => {
    expect(wellnessInjuryAreasMigration.version).toBe(8);
    expect(MIGRATIONS[7]).toBe(wellnessInjuryAreasMigration);
  });

  it('accepts the three new values that 007 refused', () => {
    const before = migrated(7);
    expect(insert(before, 'a', ['muscle_tear'])).toEqual({ ok: false });
    before.close();

    const after = migrated(8);
    for (const [index, area] of ['muscle_tear', 'plantar_fasciitis', 'shin_splints'].entries()) {
      expect(insert(after, `n${index}`, [area])).toEqual({ ok: true });
    }
    expect(insert(after, 'all', WELLNESS_AFFECTED_AREAS)).toEqual({ ok: true });
    after.close();
  });

  it('still refuses tokens outside the vocabulary, on insert and update', () => {
    const db = migrated(8);
    expect(insert(db, 'bad', ['Knee'])).toEqual({ ok: false });
    expect(insert(db, 'ok', ['knee'])).toEqual({ ok: true });
    expect(() =>
      db
        .prepare(
          "UPDATE wellness_safety_profiles SET affected_areas = '[\"elbowz\"]' WHERE id = 'ok'",
        )
        .run(),
    ).toThrow();
    db.close();
  });
});
