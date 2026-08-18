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

function dateFieldWith(dateFormatMessage: string, validDateMessage: string) {
  return z
    .string()
    .regex(DATE_RE, dateFormatMessage)
    .refine((v) => !Number.isNaN(Date.parse(v)), validDateMessage);
}

function text(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

// ── Body weight ─────────────────────────────────────────────────────────────
/** Localizable validation messages for the body-weight form (bounds are fixed). */
export interface BodyWeightFormMessages {
  dateFormat: string;
  validDate: string;
  weightPositive: string;
  tooLarge: string;
}

const BODY_WEIGHT_DEFAULT_MESSAGES: BodyWeightFormMessages = {
  dateFormat: 'Use the date format YYYY-MM-DD',
  validDate: 'Enter a valid date',
  weightPositive: 'Enter a weight greater than 0',
  tooLarge: 'Too large',
};

// Factory mirrors createBodyMeasurementFormSchema so the form can inject
// localized messages; validation bounds are unchanged.
export function createBodyWeightFormSchema(
  messages: BodyWeightFormMessages = BODY_WEIGHT_DEFAULT_MESSAGES,
) {
  return z.object({
    date: dateFieldWith(messages.dateFormat, messages.validDate),
    weightKg: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      z.coerce.number().positive(messages.weightPositive).max(1000, messages.tooLarge),
    ),
    notes: optionalText,
  });
}

export const bodyWeightFormSchema = createBodyWeightFormSchema();

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
// Public-v1 focused scope: at least one visible wellness metric is required;
// also supports arms/neck — deferred to a later slice to keep the form small.
/** Localizable validation messages for the body-measurement form (bounds fixed). */
export interface BodyMeasurementFormMessages {
  dateFormat: string;
  validDate: string;
  waistPositive: string;
  hipPositive: string;
  chestPositive: string;
  tooLarge: string;
  bodyFatPositive: string;
  bodyFatRange: string;
  muscleMassRange: string;
  atLeastOne: string;
}

const BODY_MEASUREMENT_DEFAULT_MESSAGES: BodyMeasurementFormMessages = {
  dateFormat: 'Use the date format YYYY-MM-DD',
  validDate: 'Enter a valid date',
  waistPositive: 'Enter a waist measurement greater than 0',
  hipPositive: 'Enter a hip measurement greater than 0',
  chestPositive: 'Enter a chest measurement greater than 0',
  tooLarge: 'Too large',
  bodyFatPositive: 'Enter a body-fat % greater than 0',
  bodyFatRange: 'Enter a body-fat % between 0 and 100',
  muscleMassRange: 'Enter muscle mass greater than 0 and at most 300 kg',
  atLeastOne: 'Enter at least one body measurement',
};

export function createBodyMeasurementFormSchema(
  messages: BodyMeasurementFormMessages = BODY_MEASUREMENT_DEFAULT_MESSAGES,
) {
  return z
    .object({
      date: dateFieldWith(messages.dateFormat, messages.validDate),
      waistCm: optionalNumber(
        z.coerce.number().positive(messages.waistPositive).max(500, messages.tooLarge),
      ),
      hipCm: optionalNumber(
        z.coerce.number().positive(messages.hipPositive).max(500, messages.tooLarge),
      ),
      chestCm: optionalNumber(
        z.coerce.number().positive(messages.chestPositive).max(500, messages.tooLarge),
      ),
      bodyFatPct: optionalNumber(
        z.coerce.number().positive(messages.bodyFatPositive).max(100, messages.bodyFatRange),
      ),
      muscleMassKg: optionalNumber(
        z.coerce.number().positive(messages.muscleMassRange).max(300, messages.muscleMassRange),
      ),
      notes: optionalText,
    })
    .refine(
      (values) =>
        [values.waistCm, values.hipCm, values.chestCm, values.bodyFatPct, values.muscleMassKg].some(
          (value) => value !== undefined,
        ),
      { message: messages.atLeastOne, path: ['waistCm'] },
    );
}

export const bodyMeasurementFormSchema = createBodyMeasurementFormSchema();

export type BodyMeasurementFormInput = z.input<typeof bodyMeasurementFormSchema>;
export type BodyMeasurementFormOutput = z.output<typeof bodyMeasurementFormSchema>;

export function toBodyMeasurementInput(values: BodyMeasurementFormOutput): BodyMeasurementInput {
  return {
    date: values.date,
    waistCm: values.waistCm ?? null,
    hipCm: values.hipCm ?? null,
    chestCm: values.chestCm ?? null,
    bodyFatPct: values.bodyFatPct ?? null,
    muscleMassKg: values.muscleMassKg ?? null,
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
    muscleMassKg: '' as unknown as BodyMeasurementFormInput['muscleMassKg'],
    notes: '',
  };
}
