import { evaluate } from './engine';
import { ENGINE_RULE_VERSION, PROGRESS_SNAPSHOT_RULE_VERSION } from './rule-versions';
import type { EngineInput } from './types';
import { WORKOUT_ROUTINE_RULE_VERSION } from './workout-routine-generator';
import {
  WELLNESS_PLAN_EXPLANATION_KEYS,
  WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
} from './wellness-safety';

/**
 * **Activation invariants for ADR-P031 W-4C + W-4D.**
 *
 * This file replaces `wellness-safety.dormancy.spec.ts`, whose whole purpose
 * was to fail the moment a caller supplied `EngineInput.wellness`. That tripwire
 * has done its job: consumption is now live, so it is deleted rather than
 * weakened, and the invariants that make activation *safe* are asserted here
 * instead.
 *
 * The one that matters most is the atomicity invariant from §Implementation
 * slices: **no merged commit may make wellness consumption user-reachable
 * unless the assessment and routine generation honour the same exclusions**.
 * Half-activation — an engine that reports exclusions while the generator still
 * receives `[]` — would hand the user a routine containing exactly what they
 * asked to avoid, so the scans below fail on it.
 */

// Node built-ins used only by this Node/Jest test; the React Native tsconfig
// ships no Node types, so the sliver used here is declared locally.
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

function productionFiles(): string[] {
  return filesUnder(SRC_DIR).filter(
    (file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('.spec.'),
  );
}

const read = (file: string): string => require('node:fs').readFileSync(file, 'utf8');

/** Comments stripped, so a doc comment naming a symbol to rule it out cannot fail. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const baseInput = (): EngineInput => ({
  subject: { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80, bodyFatPct: 20 },
  activityLevel: 'MODERATE',
  goal: 'FAT_LOSS',
  fitnessLevel: 'INTERMEDIATE',
  restrictions: [],
  recovery: { sleepHours: 7.5, stressLevel: 2 },
  trainingDaysPreference: 4,
});

describe('the dormancy tripwire is gone, deliberately', () => {
  it('no dormancy spec survives to contradict activation', () => {
    const dormancy = filesUnder(`${FEATURES_DIR}/icoach`).filter((file) =>
      file.includes('dormancy'),
    );
    expect(dormancy).toEqual([]);
  });

  it('the analyzer is reachable from a production path', () => {
    // The seam's only reader, and the only production file that supplies it.
    const engine = code(read(`${__dirname}/engine.ts`));
    expect(engine).toContain('analyzeWellnessSafety(input.wellness)');

    const suppliers = productionFiles().filter((file) =>
      /\bwellness(\?)?:\s*(wellness\.declaration|\{)/.test(code(read(file))),
    );
    expect(suppliers.map((file) => file.split('/').pop())).toEqual(['icoach-adapter.ts']);
  });
});

describe('atomic activation: the assessment and the routine agree', () => {
  it('routine selection receives the assessment’s exclusions, never a literal []', () => {
    const plan = code(read(`${FEATURES_DIR}/workout/presentation/GeneratedWorkoutPlan.tsx`));

    expect(plan).toContain('selectWorkoutRoutine(assessment, {');
    // The activation itself.
    expect(plan).toContain('excludedMovements: assessment?.assessment.training.excludedMovements');
    // And the hardcoded empty list is gone from the call.
    expect(plan).not.toContain('excludedMovements: [],');
  });

  it('every caller of selectWorkoutRoutine passes a real exclusion set', () => {
    const callers = productionFiles().filter((file) =>
      code(read(file)).includes('selectWorkoutRoutine('),
    );
    // The service that defines it, plus the one surface that calls it.
    expect(callers.map((file) => file.split('/').pop()).sort()).toEqual([
      'GeneratedWorkoutPlan.tsx',
      'workout-routine.service.ts',
    ]);

    for (const file of callers) {
      if (file.endsWith('workout-routine.service.ts')) continue;
      expect(code(read(file))).not.toMatch(/excludedMovements:\s*\[\s*\]/);
    }
  });

  it('the engine and the plan derive their exclusions from one computation', () => {
    const assessment = evaluate({
      ...baseInput(),
      wellness: {
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: [],
        movementsToAvoid: ['running', 'jumping', 'running'],
      },
    });

    // One sorted, de-duplicated list, and the recommendation reports exactly it.
    expect(assessment.training.excludedMovements).toEqual(['jumping', 'running']);
    const rec = assessment.recommendations.find(
      (candidate) => candidate.id === WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
    );
    expect(rec).toBeDefined();
    expect(String(rec?.inputs.movements).split(',')).toEqual(assessment.training.excludedMovements);
  });

  it('the wellness read is the only source of an engine wellness input', () => {
    const adapter = code(read(`${FEATURES_DIR}/dashboard/application/icoach-adapter.ts`));

    // Only an `available` outcome may populate it, and the medical path stays
    // unwired.
    expect(adapter).toContain("wellness.status === 'available'");
    expect(adapter).toContain('wellness: wellness.declaration');
    expect(adapter).toContain('restrictions: [],');
    expect(adapter).not.toContain('@/features/medical');
  });
});

describe('rule-version boundaries', () => {
  it('each family moves only for its own reason', () => {
    // The assessment family moved with W-4B (the wellness rule itself).
    expect(ENGINE_RULE_VERSION).toBe('icoach-rules@1.2.0');
    // The routine family moves with W-4D: routines are now filtered by the
    // user's declarations.
    expect(WORKOUT_ROUTINE_RULE_VERSION).toBe('icoach-workout-rules@1.1.0');
    // Weekly snapshots consume no wellness data, so their identity is frozen.
    expect(PROGRESS_SNAPSHOT_RULE_VERSION).toBe('icoach-rules@1.1.0');

    // Three independent families: collapsing any two back together fails here.
    expect(
      new Set([ENGINE_RULE_VERSION, WORKOUT_ROUTINE_RULE_VERSION, PROGRESS_SNAPSHOT_RULE_VERSION])
        .size,
    ).toBe(3);
  });

  it('the exercise catalogue version did not move with the rule', () => {
    const generator = code(read(`${__dirname}/workout-routine-generator.ts`));
    // The catalogue is unchanged, so its version is not restamped here.
    expect(generator).not.toContain('EXERCISE_CATALOG_VERSION =');
  });
});

describe('one explanation-key family', () => {
  it('the competing snake_case spelling is gone', () => {
    expect(WELLNESS_PLAN_EXPLANATION_KEYS).toEqual({
      title: 'wellness.plan.limitationsAppliedTitle',
      body: 'wellness.plan.limitationsAppliedBody',
      basis: 'wellness.plan.limitationsAppliedBasis',
    });

    const offenders = productionFiles().filter((file) =>
      code(read(file)).includes('wellness.plan.limitations_applied'),
    );
    expect(offenders).toEqual([]);
  });

  it('the recommendation is rendered from exactly those keys', () => {
    const assessment = evaluate({
      ...baseInput(),
      wellness: {
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: [],
        movementsToAvoid: ['dips'],
      },
    });
    const rec = assessment.recommendations.find(
      (candidate) => candidate.id === WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
    );
    expect([rec?.title, rec?.explanation, rec?.scientificBasis]).toEqual([
      WELLNESS_PLAN_EXPLANATION_KEYS.title,
      WELLNESS_PLAN_EXPLANATION_KEYS.body,
      WELLNESS_PLAN_EXPLANATION_KEYS.basis,
    ]);
  });
});
