import { evaluate } from './engine';
import type { EngineInput } from './types';
import { WELLNESS_RULE_MOVEMENT_EXCLUSIONS } from './wellness-safety';

/**
 * **Dormancy proof for ADR-P031 W-4B.**
 *
 * W-4B ships the analyzer, the optional `EngineInput.wellness` seam, the
 * `TrainingPlan.excludedMovements` union and the `decodeConflictSnapshot`
 * projection — and none of it may be reachable by a user. ADR-P031's
 * §Implementation slices makes that a hard invariant: no merged commit may make
 * wellness consumption user-reachable unless the assessment *and* routine
 * generation honour the same exclusions, with complete EN/ES copy, Error
 * handling and privacy guards. That is the W-4C/W-4D atomic activation slice.
 *
 * A type-level `wellness?:` is not evidence of dormancy on its own — a caller
 * could start passing it in any later commit and nothing would fail. So this
 * spec scans the **shipped source** and fails the moment a production file
 * supplies a wellness input or stops passing the hardcoded `[]` into routine
 * selection. It is the test that has to be deleted, deliberately, when
 * activation happens.
 */

// Node built-ins used only by this Node/Jest test; the React Native tsconfig
// ships no Node types, so the sliver used here is declared locally (the
// approach `wellness-safety-profile.spec.ts` takes).
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const SRC_DIR = `${__dirname}/../../..`;
const FEATURES_DIR = `${__dirname}/../..`;

function filesUnder(dir: string): string[] {
  const fs = require('node:fs');
  return fs.readdirSync(dir).flatMap((name: string) => {
    const path = `${dir}/${name}`;
    return fs.statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** Every shipped `.ts`/`.tsx` file — tests excluded, they are not callers. */
function productionFiles(): string[] {
  return filesUnder(SRC_DIR).filter(
    (file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('.spec.'),
  );
}

const read = (file: string): string => require('node:fs').readFileSync(file, 'utf8');

/** Comments stripped, so a doc comment naming a symbol to rule it out cannot fail. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('W-4B dormancy (ADR-P031)', () => {
  it('no production file supplies EngineInput.wellness', () => {
    // Any of these in a production file would mean a real caller exists: an
    // object literal setting the field, or a direct call to the analyzer.
    const offenders = productionFiles().filter((file) => {
      const text = code(read(file));
      if (file.endsWith('/domain/wellness-safety.ts')) return false; // the analyzer itself
      if (file.endsWith('/domain/engine.ts')) return false; // the seam's only reader
      if (file.endsWith('/domain/types.ts')) return false; // the optional field's declaration
      if (file.endsWith('/features/icoach/index.ts')) return false; // the barrel
      return (
        /\bwellness\s*:/.test(text) ||
        text.includes('analyzeWellnessSafety(') ||
        text.includes('WellnessSafetyInput')
      );
    });
    expect(offenders).toEqual([]);
  });

  it('the dashboard adapter builds its EngineInput without a wellness field', () => {
    const adapter = code(read(`${FEATURES_DIR}/dashboard/application/icoach-adapter.ts`));

    // The adapter is the only production path that constructs an EngineInput.
    expect(adapter).toContain('const input: EngineInput = {');
    expect(adapter).not.toMatch(/\bwellness\b/);
    // And the medical feature is still not wired either.
    expect(adapter).toContain('restrictions: [],');
  });

  it('the engine reads the seam but never invents an input', () => {
    const engine = code(read(`${__dirname}/engine.ts`));

    // Exactly one read of the optional field, and no default that would
    // fabricate a declaration.
    expect(engine).toContain('analyzeWellnessSafety(input.wellness)');
    expect(engine).not.toContain('input.wellness ??');
    expect(engine).not.toContain('input.wellness ||');

    // With no wellness input — the production shape — the plan is empty and no
    // wellness recommendation is emitted.
    const productionShape: EngineInput = {
      subject: { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80, bodyFatPct: 20 },
      activityLevel: 'MODERATE',
      goal: 'FAT_LOSS',
      fitnessLevel: 'INTERMEDIATE',
      restrictions: [],
      recovery: { sleepHours: 7.5, stressLevel: 2 },
      trainingDaysPreference: 4,
    };
    expect(productionShape).not.toHaveProperty('wellness');

    const assessment = evaluate(productionShape);
    expect(assessment.training.excludedMovements).toEqual([]);
    expect(assessment.recommendations.map((rec) => rec.id)).not.toContain(
      WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
    );
  });

  it('routine selection still receives a hardcoded empty exclusion list', () => {
    // W-4D replaces this with `TrainingPlan.excludedMovements`, together with
    // the copy, the Error states and the routine rule-version bump — never
    // before, and never on its own.
    const plan = code(read(`${FEATURES_DIR}/workout/presentation/GeneratedWorkoutPlan.tsx`));
    expect(plan).toContain('selectWorkoutRoutine(assessment, {');
    expect(plan).toContain('excludedMovements: [],');
    expect(plan).not.toContain('training.excludedMovements');
    expect(plan).not.toMatch(/\bwellness\b/i);

    const guidance = code(read(`${FEATURES_DIR}/workout/domain/training-guidance.ts`));
    expect(guidance).toContain('excludedMovements: [],');
    expect(guidance).not.toMatch(/\bwellness\b/i);
  });

  it('decodeConflictSnapshot is a pure, uncalled seam with no store access', () => {
    const decoder = read(`${FEATURES_DIR}/wellness/domain/wellness-safety-profile.decode.ts`);
    const decoderCode = code(decoder);

    // Pure: the whole module reaches no database, no sync queue, no conflict
    // store, no clock and no network. C-B selection is W-4C's work.
    for (const forbidden of [
      'getDatabase',
      'queryAll',
      'queryFirst',
      'runAsync',
      'sync_conflicts',
      'conflict-store',
      '@/shared/infrastructure',
      'enqueue',
      'fetch(',
      'Date.now',
      'new Date(',
    ]) {
      expect(decoderCode).not.toContain(forbidden);
    }

    // Uncalled: only the module itself and the feature barrel name it.
    const namers = productionFiles().filter((file) =>
      read(file).includes('decodeConflictSnapshot'),
    );
    expect(namers.map((file) => file.split('/').pop()).sort()).toEqual([
      'index.ts',
      'wellness-safety-profile.decode.ts',
    ]);
  });
});
