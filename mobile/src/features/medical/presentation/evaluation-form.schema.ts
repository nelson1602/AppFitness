import { z } from 'zod';

import type { EvaluationInput } from '../domain/medical.types';

/**
 * Zod is the single validation source of truth for the evaluation form
 * (same approach as the profile/goal forms). Text inputs yield strings, so
 * the schema coerces/validates and `toEvaluationInput` maps the parsed
 * output onto the domain `EvaluationInput`.
 *
 * Free-text fields (doctorNotes / medicalConditions / medications) are
 * ordinary optional strings HERE — they are encrypted downstream by the
 * medical repository before touching SQLite (ADR-P001). This form never
 * persists, logs, or transforms those values beyond trimming.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as YYYY-MM-DD, used as the default evaluation date. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Optional numeric: blank input ('' / null / undefined) → undefined; else coerce + validate.
const optionalNumber = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    schema.optional(),
  );

// Optional free-text: blank → undefined; else a bounded string.
const optionalText = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().max(2000).optional(),
);

export const evaluationFormSchema = z.object({
  // Required for the iCoach engine (body composition + nutrition).
  evaluationDate: z
    .string()
    .regex(DATE_RE, 'Use YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  weightKg: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().positive('Must be greater than 0').max(500, 'Too large'),
  ),
  // Optional physical metrics.
  bodyFatPct: optionalNumber(z.coerce.number().min(0).max(100, 'Must be 0–100')),
  muscleMassKg: optionalNumber(z.coerce.number().positive().max(300, 'Too large')),
  bloodPressureSystolic: optionalNumber(z.coerce.number().int().min(50).max(300)),
  bloodPressureDiastolic: optionalNumber(z.coerce.number().int().min(30).max(250)),
  restingHeartRate: optionalNumber(z.coerce.number().int().min(20).max(250)),
  sleepQuality: optionalNumber(z.coerce.number().int().min(1).max(5, 'Scale 1–5')),
  stressLevel: optionalNumber(z.coerce.number().int().min(1).max(5, 'Scale 1–5')),
  activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']).optional(),
  // Optional free-text (encrypted downstream by the repository).
  doctorNotes: optionalText,
  medicalConditions: optionalText,
  medications: optionalText,
});

export type EvaluationFormInput = z.input<typeof evaluationFormSchema>;
export type EvaluationFormOutput = z.output<typeof evaluationFormSchema>;

/** Blank create-mode defaults (evaluations are append-only — no edit prefill). */
export function evaluationFormDefaults(): EvaluationFormInput {
  return {
    evaluationDate: todayIso(),
    weightKg: '' as unknown as EvaluationFormInput['weightKg'],
    bodyFatPct: '' as unknown as EvaluationFormInput['bodyFatPct'],
    muscleMassKg: '' as unknown as EvaluationFormInput['muscleMassKg'],
    bloodPressureSystolic: '' as unknown as EvaluationFormInput['bloodPressureSystolic'],
    bloodPressureDiastolic: '' as unknown as EvaluationFormInput['bloodPressureDiastolic'],
    restingHeartRate: '' as unknown as EvaluationFormInput['restingHeartRate'],
    sleepQuality: '' as unknown as EvaluationFormInput['sleepQuality'],
    stressLevel: '' as unknown as EvaluationFormInput['stressLevel'],
    activityLevel: undefined,
    doctorNotes: '',
    medicalConditions: '',
    medications: '',
  };
}

/** Parsed, validated form output → domain EvaluationInput (persistence shape). */
export function toEvaluationInput(values: EvaluationFormOutput): EvaluationInput {
  const text = (v: string | undefined): string | null => {
    const t = v?.trim();
    return t ? t : null;
  };
  return {
    evaluationDate: values.evaluationDate,
    weightKg: values.weightKg,
    bodyFatPct: values.bodyFatPct ?? null,
    muscleMassKg: values.muscleMassKg ?? null,
    bloodPressureSystolic: values.bloodPressureSystolic ?? null,
    bloodPressureDiastolic: values.bloodPressureDiastolic ?? null,
    restingHeartRate: values.restingHeartRate ?? null,
    sleepQuality: values.sleepQuality ?? null,
    stressLevel: values.stressLevel ?? null,
    activityLevel: values.activityLevel ?? null,
    doctorNotes: text(values.doctorNotes),
    medicalConditions: text(values.medicalConditions),
    medications: text(values.medications),
  };
}
