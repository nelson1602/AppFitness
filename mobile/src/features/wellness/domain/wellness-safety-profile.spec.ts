import { BUILT_IN_EXERCISES } from '@/features/workout/infrastructure/exercise-catalog.data';

import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
  WELLNESS_SAFETY_PROFILE_CONTRACT_VERSION,
  WELLNESS_TOKEN_LIST_MAX,
} from './wellness-safety-profile';

/**
 * Contract audit for ADR-P017 **W-1**.
 *
 * The vocabularies are the whole product of this slice, so they are checked
 * against their sources rather than against themselves: the movement tokens
 * against the shipped built-in exercise catalog, the field set against the
 * prohibited-input list in the owner clarification, and the feature directory
 * against the W-1 scope boundary (contract and storage only).
 */

// Node built-ins used only by this Node/Jest test; the React Native tsconfig
// ships no Node types, so the sliver used here is declared locally (the
// approach `migrations/node-sqlite.d.ts` takes for `node:sqlite`).
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
};

const CONTRACT_SOURCE = `${__dirname}/wellness-safety-profile.ts`;
const FEATURE_DIR = `${__dirname}/..`;

function source(): string {
  return require('node:fs').readFileSync(CONTRACT_SOURCE, 'utf8');
}

describe('Wellness Safety Profile contract', () => {
  it('pins a contract version future slices can depend on', () => {
    expect(WELLNESS_SAFETY_PROFILE_CONTRACT_VERSION).toBe('wellness-safety-profile@1.0.0');
    expect(WELLNESS_TOKEN_LIST_MAX).toBe(64);
  });

  describe('movements to avoid', () => {
    /** Every movement pattern any shipped built-in exercise declares. */
    const catalogUnion = [
      ...new Set(BUILT_IN_EXERCISES.flatMap((exercise) => exercise.movementPatterns)),
    ].sort();

    it('is exactly the union the built-in exercise catalog uses', () => {
      // Not a parallel identifier system: the offered tokens are the catalog's
      // own vocabulary. If the catalog gains or drops a pattern this fails, so
      // the vocabulary change becomes a deliberate decision instead of a token
      // that can never match (or one that silently goes missing).
      expect([...WELLNESS_MOVEMENTS_TO_AVOID]).toEqual(catalogUnion);
      expect(catalogUnion.length).toBeGreaterThan(0);
    });

    it('offers only tokens at least one built-in exercise can match', () => {
      for (const token of WELLNESS_MOVEMENTS_TO_AVOID) {
        const matching = BUILT_IN_EXERCISES.filter((exercise) =>
          (exercise.movementPatterns as readonly string[]).includes(token),
        );
        expect(matching.length).toBeGreaterThan(0);
      }
    });

    it('records why a declared-but-unused pattern is excluded', () => {
      // `behind_neck_press` is part of the MovementPattern type but no shipped
      // exercise declares it, so selecting it could exclude nothing.
      expect(WELLNESS_MOVEMENTS_TO_AVOID).not.toContain('behind_neck_press');
      expect(source()).toContain('behind_neck_press');
    });
  });

  describe('affected areas', () => {
    it('is a fixed, unique, sorted, language-neutral vocabulary', () => {
      expect([...WELLNESS_AFFECTED_AREAS]).toEqual([
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
        'neck',
        'shoulder',
        'thigh',
        'upper_arm',
        'upper_back',
        'wrist',
      ]);
      expect(new Set(WELLNESS_AFFECTED_AREAS).size).toBe(WELLNESS_AFFECTED_AREAS.length);
      expect([...WELLNESS_AFFECTED_AREAS]).toEqual([...WELLNESS_AFFECTED_AREAS].sort());
    });

    it('excludes head, and records why', () => {
      // A head-related concern belongs with a qualified professional, not in a
      // deterministic exercise mapping.
      expect(WELLNESS_AFFECTED_AREAS).not.toContain('head');
      const contract = source();
      expect(contract).toContain('`head` is deliberately **excluded**');
    });

    it('is anatomical, never diagnostic', () => {
      for (const token of WELLNESS_AFFECTED_AREAS) {
        // Stable, lowercase, snake_case identifiers: no locale, no punctuation,
        // nothing a presentation label would carry.
        expect(token).toMatch(/^[a-z]+(_[a-z]+)*$/);
      }
      const joined = WELLNESS_AFFECTED_AREAS.join(' ');
      for (const clinical of [
        'injury',
        'pain',
        'surgery',
        'fracture',
        'hernia',
        'tendinitis',
        'arthritis',
        'sprain',
        'chronic',
        'acute',
        'severe',
        'mild',
      ]) {
        expect(joined).not.toContain(clinical);
      }
    });
  });

  describe('token normalization is the same on both vocabularies', () => {
    it('keeps every token lowercase, trimmed and snake_case', () => {
      for (const token of [...WELLNESS_AFFECTED_AREAS, ...WELLNESS_MOVEMENTS_TO_AVOID]) {
        expect(token).toBe(token.trim());
        expect(token).toBe(token.toLowerCase());
        expect(token).toMatch(/^[a-z]+(_[a-z]+)*$/);
      }
    });

    it('bounds both vocabularies well below the stored list limit', () => {
      expect(WELLNESS_AFFECTED_AREAS.length).toBeLessThanOrEqual(WELLNESS_TOKEN_LIST_MAX);
      expect(WELLNESS_MOVEMENTS_TO_AVOID.length).toBeLessThanOrEqual(WELLNESS_TOKEN_LIST_MAX);
    });
  });

  describe('prohibited inputs', () => {
    it('declares no clinical, supplement or free-text field', () => {
      const contract = source();
      const interfaceBody = /export interface WellnessSafetyProfile \{([\s\S]*?)\n\}/.exec(
        contract,
      );
      expect(interfaceBody).not.toBeNull();
      // Field names only — the surrounding prose names these concepts precisely
      // in order to rule them out.
      const fields = [...(interfaceBody?.[1] ?? '').matchAll(/^\s+readonly (\w+)/gm)].map(
        (match) => match[1],
      );
      expect(fields).toEqual([
        'id',
        'userId',
        'evaluationCompleted',
        'evaluationDate',
        'affectedAreas',
        'movementsToAvoid',
        'createdAt',
        'updatedAt',
        'version',
        'deletedAt',
        'deletedBy',
      ]);

      const lowered = fields.map((field) => field.toLowerCase());
      for (const forbidden of [
        'provider',
        'doctor',
        'clinic',
        'clearance',
        'diagnos',
        'condition',
        'medication',
        'treatment',
        'bloodpressure',
        'rehab',
        'symptom',
        'severity',
        'dosage',
        'supplement',
        'note',
        'comment',
        'description',
        'finding',
        'result',
        'document',
        'attachment',
        'text',
      ]) {
        expect(lowered.filter((field) => field.includes(forbidden))).toEqual([]);
      }
    });

    it('reuses no medical model, enum or mapping', () => {
      const contract = source();
      const imports = [...contract.matchAll(/^import .*?from '(.+?)';$/gm)].map(
        (match) => match[1],
      );
      // The only dependency is the workout catalog's movement-pattern type.
      expect(imports).toEqual(['@/features/workout/domain/exercise-catalog']);
      for (const forbidden of [
        'features/medical',
        'MedicalRestriction',
        'RestrictionType',
        'RestrictionSeverity',
        'BODY_AREA_EXCLUSIONS',
        'medical_restrictions',
        'medical_evaluations',
      ]) {
        // Named in prose to rule it out is fine; imported or referenced as code
        // is not, so only the executable part of the file is scanned.
        const code = contract
          .split('\n')
          .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
          .join('\n');
        expect(code).not.toContain(forbidden);
      }
    });
  });

  describe('cross-layer allowlist audit', () => {
    // The migrations are the enforcement point, so the contract is compared to
    // what they actually write rather than to a duplicated constant. The SQLite
    // trigger predicates are audited in
    // `migrations/007-wellness-safety-profile.spec.ts`; PostgreSQL is audited
    // here because that is where the TypeScript contract lives.
    const PG_MIGRATION = `${__dirname}/../../../../../api/prisma/migrations/20260908120000_add_wellness_safety_profiles/migration.sql`;

    function postgresAllowlist(column: string): string[] {
      const sql = require('node:fs').readFileSync(PG_MIGRATION, 'utf8');
      const section = new RegExp(`"${column}" <@ ARRAY\\[([\\s\\S]*?)\\]::text\\[\\]`).exec(sql);
      expect(section).not.toBeNull();
      return [...(section?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
    }

    it('constrains affected_areas to exactly the contract vocabulary', () => {
      expect(postgresAllowlist('affected_areas')).toEqual([...WELLNESS_AFFECTED_AREAS]);
    });

    it('constrains movements_to_avoid to exactly the contract vocabulary', () => {
      expect(postgresAllowlist('movements_to_avoid')).toEqual([...WELLNESS_MOVEMENTS_TO_AVOID]);
    });

    it('keeps the structural checks alongside the allowlist', () => {
      const sql = require('node:fs').readFileSync(PG_MIGRATION, 'utf8');
      for (const column of ['affected_areas', 'movements_to_avoid']) {
        expect(sql).toContain(`coalesce(array_ndims("${column}"), 1) = 1`);
        expect(sql).toContain(`cardinality("${column}") <= ${WELLNESS_TOKEN_LIST_MAX}`);
        expect(sql).toContain(`array_position("${column}", NULL) IS NULL`);
      }
    });
  });

  describe('ownership is represented, not enforced, by W-1', () => {
    it(`states the owner predicate is W-2's obligation`, () => {
      const contract = source();
      // A foreign key proves the owner exists; it does not stop a query by id
      // from reading another account's row.
      expect(contract).not.toContain('structurally impossible');
      expect(contract).toContain('structurally represented and cascade-protected');
      expect(contract).toContain('every read, write,');
      expect(contract).toContain('cross-user denial tests');
    });
  });

  describe('W-1 scope boundary', () => {
    it('ships contract only — no repository, store, sync, screen or registration', () => {
      const fs = require('node:fs');
      expect(fs.readdirSync(FEATURE_DIR).sort()).toEqual(['domain', 'index.ts']);
      expect(fs.readdirSync(`${FEATURE_DIR}/domain`).sort()).toEqual([
        'wellness-safety-profile.spec.ts',
        'wellness-safety-profile.ts',
      ]);

      const contract = source();
      for (const forbidden of [
        'getDatabase',
        'queryAll',
        'queryFirst',
        'runAsync',
        'create(',
        'zustand',
        'registerSyncAppliers',
        'SyncEntityRegistry',
        'enqueue',
      ]) {
        expect(contract).not.toContain(forbidden);
      }
    });
  });
});
