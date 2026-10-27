// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test.
import { DatabaseSync } from 'node:sqlite';

import { weeklyPlansMigration } from './009-weekly-plans';
import { MIGRATIONS } from './index';

/** ADR-P042 — saved weekly plans and plan links, run against the real prior schema. */
function migrated(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS)
    for (const statement of migration.statements) db.exec(statement);
  db.prepare(
    "INSERT INTO local_user (id, email, username, created_at, updated_at) VALUES ('u1','u@x.test','u','2026-10-26','2026-10-26')",
  ).run();
  return db;
}

const T = '2026-10-26T00:00:00.000Z';

function insertPlan(
  db: DatabaseSync,
  id: string,
  over: Partial<Record<string, string | number | null>> = {},
): boolean {
  const row = {
    week_start: '2026-10-26',
    revision: 1,
    effective_from: '2026-10-26',
    generation_trigger: 'WEEKLY',
    load_step: 0,
    plan: '{"days":[]}',
    deleted_at: null,
    ...over,
  };
  try {
    db.prepare(
      `INSERT INTO weekly_plans (id, user_id, created_at, updated_at, week_start, revision, effective_from,
         generation_trigger, load_step, inputs_fingerprint, rule_versions, plan, notes, deleted_at)
       VALUES (?, 'u1', ?, ?, ?, ?, ?, ?, ?, 'abc', '{}', ?, '[]', ?)`,
    ).run(
      id,
      T,
      T,
      row.week_start,
      row.revision,
      row.effective_from,
      row.generation_trigger,
      row.load_step,
      row.plan,
      row.deleted_at,
    );
    return true;
  } catch {
    return false;
  }
}

describe('migration 009 — weekly plans', () => {
  it('is registered ninth', () => {
    expect(weeklyPlansMigration.version).toBe(9);
    expect(MIGRATIONS[8]).toBe(weeklyPlansMigration);
  });

  it('keeps one live row per user, week and revision', () => {
    const db = migrated();
    expect(insertPlan(db, 'a')).toBe(true);
    expect(insertPlan(db, 'b')).toBe(false);
    expect(insertPlan(db, 'c', { revision: 2, effective_from: '2026-10-29' })).toBe(true);
    // A tombstone does not block a re-created revision.
    expect(
      insertPlan(db, 'd', {
        week_start: '2026-11-02',
        effective_from: '2026-11-02',
        deleted_at: T,
      }),
    ).toBe(true);
    expect(insertPlan(db, 'e', { week_start: '2026-11-02', effective_from: '2026-11-02' })).toBe(
      true,
    );
    db.close();
  });

  it.each([
    ['an unknown trigger', { generation_trigger: 'SOMETIMES' }],
    ['a load step above 4', { load_step: 5 }],
    ['a malformed date', { week_start: '26/10/2026' }],
    ['invalid JSON', { plan: '{days' }],
  ])('refuses %s', (_label, over) => {
    const db = migrated();
    expect(insertPlan(db, 'x', over)).toBe(false);
    db.close();
  });

  it('adds nullable plan links to workout_logs and meal_items', () => {
    const db = migrated();
    const columns = (table: string) =>
      (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    expect(columns('workout_logs')).toEqual(
      expect.arrayContaining(['weekly_plan_id', 'plan_session_key', 'plan_date']),
    );
    expect(columns('meal_items')).toEqual(
      expect.arrayContaining(['plan_id', 'plan_date', 'plan_slot']),
    );
    db.close();
  });

  it('erases the plans with the account', () => {
    const db = migrated();
    insertPlan(db, 'a');
    db.prepare("DELETE FROM local_user WHERE id = 'u1'").run();
    expect((db.prepare('SELECT COUNT(*) AS n FROM weekly_plans').get() as { n: number }).n).toBe(0);
    db.close();
  });
});
