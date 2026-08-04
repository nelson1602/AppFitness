import { z } from 'zod';

import type { BodyMeasurementInput, BodyWeightInput } from '../domain/progress';

/**
 * Zod is the single validation source of truth for the Progress entry forms
 * (ADR-P016 Phase 17 Slice 5a) — same approach as the evaluation/goal/profile
 * forms. Text inputs yield strings, so numeric fields use `z.preprocess` +
 * `z.coerce.number` (this also keeps `z.input` as `unknown`, so the RHF
 * `Control` stays assignable to the shared `FormField`). The `to…Input` mappers
 * produce the persistence `BodyWeightInput` / `BodyMeasurementInput`.
 * Presentational validation only — no persistence, and (D6) `date` is a
 * user-local `YYYY-MM-DD` resolved by the caller, never a clock read in here.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Optional numeric: blank ('' / null / undefined) → undefined; else coerce + validate.
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

const dateField = z
  .string()
  .regex(DATE_RE, 'Use the date format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date');

function text(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

// ── Body weight ─────────────────────────────────────────────────────────────
export const bodyWeightFormSchema = z.object({
  date: dateField,
  weightKg: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().positive('Enter a weight greater than 0').max(1000, 'Too large'),
  ),
  notes: optionalText,
});

export type BodyWeightFormInput = z.input<typeof bodyWeightFormSchema>;
export type BodyWeightFormOutput = z.output<typeof bodyWeightFormSchema>;

export function toBodyWeightInput(values: BodyWeightFormOutput): BodyWeightInput {
  return {
    date: values.date,
    weightKg: values.weightKg,
    notes: text(values.notes),
  };
}

export function blankBodyWeightValues(date: string): BodyWeightFormInput {
  return {
    date,
    weightKg: '' as unknown as BodyWeightFormInput['weightKg'],
    notes: '',
  };
}

// ── Body measurement ────────────────────────────────────────────────────────
// v1 focused scope (D4): waist required; hip/chest/body-fat optional. The domain
// also supports arms/neck — deferred to a later slice to keep the form small.
export const bodyMeasurementFormSchema = z.object({
  date: dateField,
  waistCm: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().positive('Enter a waist measurement greater than 0').max(500, 'Too large'),
  ),
  hipCm: optionalNumber(
    z.coerce.number().positive('Enter a hip measurement greater than 0').max(500, 'Too large'),
  ),
  chestCm: optionalNumber(
    z.coerce.number().positive('Enter a chest measurement greater than 0').max(500, 'Too large'),
  ),
  bodyFatPct: optionalNumber(
    z.coerce.number().positive().max(100, 'Enter a body-fat % between 0 and 100'),
  ),
  notes: optionalText,
});

export type BodyMeasurementFormInput = z.input<typeof bodyMeasurementFormSchema>;
export type BodyMeasurementFormOutput = z.output<typeof bodyMeasurementFormSchema>;

export function toBodyMeasurementInput(values: BodyMeasurementFormOutput): BodyMeasurementInput {
  return {
    date: values.date,
    waistCm: values.waistCm,
    hipCm: values.hipCm ?? null,
    chestCm: values.chestCm ?? null,
    bodyFatPct: values.bodyFatPct ?? null,
    notes: text(values.notes),
  };
}

export function blankBodyMeasurementValues(date: string): BodyMeasurementFormInput {
  return {
    date,
    waistCm: '' as unknown as BodyMeasurementFormInput['waistCm'],
    hipCm: '' as unknown as BodyMeasurementFormInput['hipCm'],
    chestCm: '' as unknown as BodyMeasurementFormInput['chestCm'],
    bodyFatPct: '' as unknown as BodyMeasurementFormInput['bodyFatPct'],
    notes: '',
  };
}
