// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test.
import { DatabaseSync } from 'node:sqlite';

import { userProfileCountryMigration } from './010-user-profile-country';
import { MIGRATIONS } from './index';

const T = '2026-11-02T00:00:00.000Z';

/** Every migration before 010, with one existing profile: the device as it is today. */
function seededPre010(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) {
    if (migration.version >= 10) break;
    for (const statement of migration.statements) db.exec(statement);
  }
  db.prepare(
    `INSERT INTO local_user (id, email, username, created_at, updated_at)
     VALUES ('u1', 'u@x.test', 'u', ?, ?)`,
  ).run(T, T);
  db.prepare(
    `INSERT INTO user_profiles (id, user_id, created_at, updated_at, sync_status, height_cm)
     VALUES ('p1', 'u1', ?, ?, 'synced', 170)`,
  ).run(T, T);
  return db;
}

function apply(db: DatabaseSync): void {
  for (const statement of userProfileCountryMigration.statements) db.exec(statement);
}

describe('migration 010 — user profile country (v8.1)', () => {
  it('is appended as version 10, in tenth position', () => {
    expect(userProfileCountryMigration).toMatchObject({
      version: 10,
      name: 'user-profile-country',
    });
    expect(MIGRATIONS[9]).toBe(userProfileCountryMigration);
  });

  it('reads every existing profile as DO and leaves the rest of the row (and its sync state) alone', () => {
    const db = seededPre010();
    apply(db);
    expect(
      db
        .prepare(
          "SELECT country, height_cm, sync_status, version FROM user_profiles WHERE id = 'p1'",
        )
        .get(),
    ).toEqual({ country: 'DO', height_cm: 170, sync_status: 'synced', version: 1 });
    db.close();
  });

  it('accepts two uppercase letters and refuses anything else, like the API', () => {
    const db = seededPre010();
    apply(db);
    const set = (country: string | null) => () =>
      db.prepare("UPDATE user_profiles SET country = ? WHERE id = 'p1'").run(country);
    expect(set('MX')).not.toThrow();
    expect(set('ZZ')).not.toThrow();
    for (const bad of ['do', 'DOM', 'D', '', '1A']) expect(set(bad)).toThrow(/CHECK/i);
    expect(set(null)).toThrow(/NOT NULL/i);
    db.close();
  });
});
