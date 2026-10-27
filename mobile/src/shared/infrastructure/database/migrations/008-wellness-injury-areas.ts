import type { Migration } from './index';

/**
 * v8 Block 2 / ADR-P040 D5 — three new injury values for the first-run
 * evaluation: `muscle_tear` (Desgarre muscular), `shin_splints` (Periostitis
 * tibial) and `plantar_fasciitis` (Fascitis plantar). Mirrors the Postgres
 * migration `20261026120000_wellness_injury_areas_v8`.
 *
 * Migration 007 is shipped and immutable, so its two vocabulary triggers are
 * replaced here, not edited. Purely additive in effect: the allowed set only
 * grows, so every existing row stays valid. The lists are frozen copies, like
 * 007's, so a later vocabulary change cannot silently rewrite this migration.
 */
const AFFECTED_AREAS = [
  'abdomen',
  'ankle',
  'chest',
  'elbow',
  'foot',
  'forearm',
  'groin',
  'hand',
  'hip',
  'knee',
  'lower_back',
  'lower_leg',
  'muscle_tear',
  'neck',
  'plantar_fasciitis',
  'shin_splints',
  'shoulder',
  'thigh',
  'upper_arm',
  'upper_back',
  'wrist',
];

const MOVEMENTS_TO_AVOID = [
  'bridging',
  'deep_squat',
  'dips',
  'front_rack_loading',
  'good_morning',
  'heavy_hinge',
  'heavy_pressing',
  'high_impact_cardio',
  'jumping',
  'loaded_carries',
  'loaded_spinal_flexion',
  'lunge',
  'max_effort_lifts',
  'overhead_press',
  'running',
  'skull_crushers',
  'sprinting',
  'valsalva_heavy_lifts',
];

const asSqlList = (tokens: readonly string[]): string =>
  tokens.map((token) => `'${token}'`).join(',');

const invalidElements = (column: string, tokens: readonly string[]): string =>
  `EXISTS (
         SELECT 1 FROM json_each(NEW.${column})
          WHERE json_each.type != 'text'
             OR json_each.value NOT IN (${asSqlList(tokens)})
       )`;

const tokenGuard = (event: 'INSERT' | 'UPDATE'): string =>
  `CREATE TRIGGER trg_wellness_safety_profiles_tokens_${event.toLowerCase()}
     BEFORE ${event} ON wellness_safety_profiles
     FOR EACH ROW
     WHEN ${invalidElements('affected_areas', AFFECTED_AREAS)}
       OR ${invalidElements('movements_to_avoid', MOVEMENTS_TO_AVOID)}
   BEGIN
     SELECT RAISE(ABORT, 'wellness_safety_profiles: token outside the allowed vocabulary');
   END`;

export const wellnessInjuryAreasMigration: Migration = {
  version: 8,
  name: 'wellness-injury-areas',
  statements: [
    'DROP TRIGGER trg_wellness_safety_profiles_tokens_insert',
    'DROP TRIGGER trg_wellness_safety_profiles_tokens_update',
    tokenGuard('INSERT'),
    tokenGuard('UPDATE'),
  ],
};
