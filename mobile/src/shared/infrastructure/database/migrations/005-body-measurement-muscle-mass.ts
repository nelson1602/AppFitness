import type { Migration } from './index';

/** Public-v1 wellness muscle-mass capture (ADR-P017 Slice 3B-1). */
export const bodyMeasurementMuscleMassMigration: Migration = {
  version: 5,
  name: 'body-measurement-muscle-mass',
  statements: [
    `ALTER TABLE body_measurements
       ADD COLUMN muscle_mass_kg REAL
       CHECK (muscle_mass_kg IS NULL OR (muscle_mass_kg > 0 AND muscle_mass_kg <= 300))`,
  ],
};
