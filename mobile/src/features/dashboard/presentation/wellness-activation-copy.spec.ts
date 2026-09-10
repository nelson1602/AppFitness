import { evaluate } from '@/features/icoach/domain/engine';
import type { EngineInput } from '@/features/icoach/domain/types';
import {
  WELLNESS_PLAN_EXPLANATION_KEYS,
  WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
} from '@/features/icoach/domain/wellness-safety';
import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
} from '@/features/wellness/domain/wellness-safety-profile';
import {
  AFFECTED_AREA_LABEL_KEY,
  MOVEMENT_LABEL_KEY,
} from '@/features/wellness/presentation/wellness-token-labels';
import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import { resolveRecommendationCopy } from './recommendation-copy';

/**
 * ADR-P031 **W-4D** copy: parity, privacy and the two Error arms
 * (tests **H32**, **H33**, **I34**).
 *
 * Two obligations meet here. The copy has to *say the right thing* — declared
 * movements change the plan, declared areas are recorded and change nothing,
 * every exclusion is kept when the catalogue runs out, and reviewing the
 * answers is available without being demanded. And it has to *not say* a raw
 * token, a count, a date, a missing pattern, a diagnosis or a clearance.
 */

const NEW_KEYS = [
  'wellness.plan.limitationsAppliedTitle',
  'wellness.plan.limitationsAppliedBody',
  'wellness.plan.limitationsAppliedBasis',
  'workout.plan.coverageTitle',
  'workout.plan.coverageBody',
  'workout.plan.wellnessUnavailableTitle',
  'workout.plan.wellnessUnavailableBody',
] as const;

const CATALOGS: [name: string, catalog: Record<string, string>][] = [
  ['en', en as unknown as Record<string, string>],
  ['es', es as unknown as Record<string, string>],
];

const values = (catalog: Record<string, string>): string[] => NEW_KEYS.map((key) => catalog[key]);

const engineInput = (movementsToAvoid: readonly string[]): EngineInput =>
  ({
    subject: { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80, bodyFatPct: 20 },
    activityLevel: 'MODERATE',
    goal: 'FAT_LOSS',
    fitnessLevel: 'INTERMEDIATE',
    restrictions: [],
    trainingDaysPreference: 4,
    wellness: {
      evaluationCompleted: true,
      evaluationDate: '2026-01-15',
      affectedAreas: ['knee', 'shoulder'],
      movementsToAvoid,
    },
  }) as EngineInput;

describe('H32: EN/ES parity', () => {
  it.each(CATALOGS)('%s defines every new key with real copy', (_name, catalog) => {
    for (const key of NEW_KEYS) {
      expect(typeof catalog[key]).toBe('string');
      expect(catalog[key].trim().length).toBeGreaterThanOrEqual(15);
    }
  });

  it('the two catalogues have exactly the same key set', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('no new key was left untranslated', () => {
    for (const key of NEW_KEYS) {
      expect(es[key as keyof typeof es]).not.toBe(en[key as keyof typeof en]);
    }
  });

  it('the token label maps still cover all 18 + 18 tokens in both languages', () => {
    for (const [, catalog] of CATALOGS) {
      for (const area of WELLNESS_AFFECTED_AREAS) {
        expect(typeof catalog[AFFECTED_AREA_LABEL_KEY[area]]).toBe('string');
      }
      for (const movement of WELLNESS_MOVEMENTS_TO_AVOID) {
        expect(typeof catalog[MOVEMENT_LABEL_KEY[movement]]).toBe('string');
      }
    }
  });
});

describe('what the copy must say', () => {
  it('explains that movements change the plan and areas are recorded but inert', () => {
    expect(en['wellness.plan.limitationsAppliedBody']).toMatch(/movements you said/i);
    expect(en['wellness.plan.limitationsAppliedBody']).toMatch(/left out of your plan/i);
    expect(en['wellness.plan.limitationsAppliedBody']).toMatch(/body areas you marked/i);
    expect(en['wellness.plan.limitationsAppliedBody']).toMatch(/do not change any exercise/i);

    expect(es['wellness.plan.limitationsAppliedBody']).toMatch(/movimientos que dijiste/i);
    expect(es['wellness.plan.limitationsAppliedBody']).toMatch(/quedaron fuera de tu plan/i);
    expect(es['wellness.plan.limitationsAppliedBody']).toMatch(/zonas del cuerpo que marcaste/i);
    expect(es['wellness.plan.limitationsAppliedBody']).toMatch(/no cambian ning[uú]n ejercicio/i);
  });

  it('says every declared exclusion is kept when coverage runs out', () => {
    expect(en['workout.plan.coverageBody']).toMatch(/all being respected/i);
    expect(en['workout.plan.coverageBody']).toMatch(/nothing has been added back/i);
    expect(es['workout.plan.coverageBody']).toMatch(/se respetan todas las limitaciones/i);
    expect(es['workout.plan.coverageBody']).toMatch(/no se volvió a agregar nada/i);
  });

  it('offers a review without pressuring the user to remove anything', () => {
    for (const [, catalog] of CATALOGS) {
      expect(catalog['workout.plan.coverageBody']).toMatch(/review|revisar/i);
      // Never framed as required, expected or "the fix".
      expect(catalog['workout.plan.coverageBody']).not.toMatch(
        /must remove|need to remove|remove (one|a limitation)|debes quitar|tienes que quitar|elimina/i,
      );
    }
  });

  it('contains none of ADR-P031’s prohibited vocabulary, in either language', () => {
    // The complete list from §Decision 10 and ADR-P017 Decision 1: no medical
    // or clinical framing, no clearance or authorization, no diagnosis or
    // treatment, no safety or fitness-to-train claim, no prescriptive advice.
    // Scoped to the W-4C/W-4D keys, so historical catalogue strings — which
    // have their own W-3 copy spec — are not re-litigated here.
    const PROHIBITED: RegExp[] = [
      // Medical and clinical framing.
      /\bmedical(ly)?\b/i,
      /\bclinical(ly)?\b/i,
      /\bm[eé]dic[oa]s?\b/i,
      /\bcl[ií]nic[oa]s?\b/i,
      /\bdoctor|\bphysician|\bnurse|\btherapist/i,
      /\bdoctora?\b|\bfisioterapeuta|\benfermer[oa]/i,
      // Clearance, authorization, approval, permission.
      /\bclear(ed|ance)?\b/i,
      /\bapprov(e|ed|al)\b/i,
      /\bauthoriz(e|ed|ation)\b/i,
      /\bpermission\b/i,
      /\bautorizaci[oó]n\b|\bautorizad[oa]s?\b/i,
      /\baprobaci[oó]n\b|\baprobad[oa]s?\b/i,
      /\bpermiso\b/i,
      /\bapt[oa]s?\b/i,
      // Diagnosis, treatment, injury, symptoms.
      /\bdiagnos(is|e|ed|tic)\b/i,
      /\bdiagn[oó]stic[oa]s?\b|\bdiagnostica/i,
      /\btreat(ment|ed|s)?\b/i,
      /\btratamiento\b|\btrata\b/i,
      /\brehabilitat|\brehabilitaci[oó]n/i,
      /\binjur(y|ies|ed)\b/i,
      /\blesi[oó]n(es)?\b|\blesionad[oa]/i,
      /\bsymptom|\bs[ií]ntoma/i,
      /\bpatholog|\bpatolog/i,
      /\bcondition\b|\bpadecimiento\b/i,
      // Safety and fitness-to-train claims.
      /\bsafe(ly|ty)?\b/i,
      /\bsegur[oa]s?\b|\bseguridad\b/i,
      /\bmedically fit\b|\bfit to train\b/i,
      /\bharmless\b|\binofensiv/i,
      // Prescriptive advice.
      /\bprescrib|\bprescrip/i,
      /\bconsult a\b|\bconsulta a un/i,
    ];

    for (const [name, catalog] of CATALOGS) {
      for (const key of NEW_KEYS) {
        const hits = PROHIBITED.filter((pattern) => pattern.test(catalog[key])).map(String);
        // Reported as an offender list so a failure names the term.
        expect({ key: `${name}:${key}`, hits }).toEqual({ key: `${name}:${key}`, hits: [] });
      }
    }
  });

  it('states the basis as the declared choices, with nothing inferred', () => {
    expect(en['wellness.plan.limitationsAppliedBasis']).toMatch(/movement choices you entered/i);
    expect(en['wellness.plan.limitationsAppliedBasis']).toMatch(/assumed or inferred/i);
    expect(es['wellness.plan.limitationsAppliedBasis']).toMatch(
      /opciones de movimiento que escribiste/i,
    );
    expect(es['wellness.plan.limitationsAppliedBasis']).toMatch(/no se supone ni se deduce/i);
  });

  it('stays calm and non-blaming, and never reads as a crash', () => {
    for (const [, catalog] of CATALOGS) {
      for (const value of values(catalog)) {
        expect(value).not.toMatch(/error|failed|falló|fallo|crash|exception|invalid|inválid/i);
        expect(value).not.toMatch(/\byou (must|have to|need to)\b|\bdebes\b|\btienes que\b/i);
      }
    }
  });
});

describe('I34: what the copy must never contain', () => {
  it('names no movement token, area token or training pattern', () => {
    const patterns = ['SQUAT', 'HINGE', 'PUSH', 'PULL', 'CARRY'];
    for (const [, catalog] of CATALOGS) {
      for (const value of values(catalog)) {
        for (const token of [...WELLNESS_MOVEMENTS_TO_AVOID, ...WELLNESS_AFFECTED_AREAS]) {
          expect(value).not.toContain(token);
        }
        for (const pattern of patterns) {
          expect(value).not.toContain(pattern);
        }
      }
    }
  });

  it('contains no count, date or evaluation metadata', () => {
    for (const [, catalog] of CATALOGS) {
      for (const value of values(catalog)) {
        // No digits at all: a count and a date are both numbers.
        expect(value).not.toMatch(/\d/);
        expect(value).not.toMatch(/evaluation date|fecha de (la )?evaluaci/i);
      }
    }
  });

  it('mentions no conflict, sync or storage detail', () => {
    for (const [, catalog] of CATALOGS) {
      for (const value of values(catalog)) {
        expect(value).not.toMatch(
          /conflict|conflicto|sync|sincroniza|database|base de datos|server|servidor|payload|JSON/i,
        );
      }
    }
  });
});

describe('the rendered recommendation', () => {
  it('resolves to localized copy, not to a raw key', () => {
    const assessment = evaluate(engineInput(['jumping', 'deep_squat', 'overhead_press']));
    const rec = assessment.recommendations.find(
      (candidate) => candidate.id === WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
    );
    expect(rec).toBeDefined();
    if (!rec) return;

    for (const [name, catalog] of CATALOGS) {
      const copy = resolveRecommendationCopy(
        rec,
        name === 'es' ? 'es' : 'en',
        (key) => catalog[key as string],
      );

      // Localized, and provably not the key itself.
      expect(copy.title).toBe(catalog[WELLNESS_PLAN_EXPLANATION_KEYS.title]);
      expect(copy.explanation).toBe(catalog[WELLNESS_PLAN_EXPLANATION_KEYS.body]);
      expect(copy.evidence).toBe(catalog[WELLNESS_PLAN_EXPLANATION_KEYS.basis]);
      for (const rendered of [copy.title, copy.explanation, copy.evidence]) {
        expect(rendered).not.toMatch(/^wellness\.plan\./);
        expect(rendered).not.toMatch(/\d/);
        for (const token of WELLNESS_MOVEMENTS_TO_AVOID) {
          expect(rendered).not.toContain(token);
        }
      }
    }
  });

  it('H33: switching language changes no computed value', () => {
    const assessment = evaluate(engineInput(['jumping', 'deep_squat']));
    const rec = assessment.recommendations.find(
      (candidate) => candidate.id === WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
    );
    if (!rec) throw new Error('the wellness recommendation was not emitted');

    const english = resolveRecommendationCopy(rec, 'en', (key) => en[key as keyof typeof en]);
    const spanish = resolveRecommendationCopy(rec, 'es', (key) => es[key as keyof typeof es]);

    // The words differ; the computation behind them does not.
    expect(spanish.title).not.toBe(english.title);
    expect(assessment.training.excludedMovements).toEqual(['deep_squat', 'jumping']);
    expect(rec.inputs.movements).toBe('deep_squat,jumping');
    expect(rec.ruleVersion).toBe('icoach-rules@1.2.0');
    // Rendering is a pure projection: it mutates neither the rule nor its inputs.
    expect(JSON.stringify(evaluate(engineInput(['jumping', 'deep_squat'])))).toBe(
      JSON.stringify(assessment),
    );
  });
});
