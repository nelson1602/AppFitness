import { DatabaseSync } from 'node:sqlite';

import { bodyMeasurementMuscleMassMigration } from './005-body-measurement-muscle-mass';
import { MIGRATIONS } from './index';

function seedPre005(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE body_measurements (
    id TEXT PRIMARY KEY NOT NULL,
    body_fat_pct REAL CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100)
  )`);
  db.exec("INSERT INTO body_measurements (id, body_fat_pct) VALUES ('m1', 18)");
  return db;
}

describe('migration 005 — body-measurement muscle mass', () => {
  it('is appended as version 5', () => {
    expect(bodyMeasurementMuscleMassMigration).toMatchObject({
      version: 5,
      name: 'body-measurement-muscle-mass',
    });
    expect(MIGRATIONS.at(-1)).toBe(bodyMeasurementMuscleMassMigration);
  });

  it('adds a nullable constrained column without changing existing rows', () => {
    const db = seedPre005();
    for (const statement of bodyMeasurementMuscleMassMigration.statements) db.exec(statement);

    expect(
      db
        .prepare("SELECT body_fat_pct, muscle_mass_kg FROM body_measurements WHERE id = 'm1'")
        .get(),
    ).toEqual({ body_fat_pct: 18, muscle_mass_kg: null });
    expect(() =>
      db.prepare('UPDATE body_measurements SET muscle_mass_kg = ? WHERE id = ?').run(42, 'm1'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE body_measurements SET muscle_mass_kg = ? WHERE id = ?').run(0, 'm1'),
    ).toThrow(/CHECK/i);
    expect(() =>
      db.prepare('UPDATE body_measurements SET muscle_mass_kg = ? WHERE id = ?').run(301, 'm1'),
    ).toThrow(/CHECK/i);

    db.close();
  });
});
