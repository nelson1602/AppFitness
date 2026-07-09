import { z } from 'zod';

import type { Goal, GoalInput } from '../domain/goal.types';

/**
 * Zod is the single validation source of truth for the goal form (same
 * approach as the profile form). Text inputs yield strings, so the schema
 * transforms strings → typed values; `toGoalInput` maps the parsed output
 * onto the domain `GoalInput`. Business logic and persistence stay out of
 * the UI — the form only validates + maps.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GOAL_TYPES = [
  'FAT_LOSS',
  'MUSCLE_GAIN',
  'RECOMPOSITION',
  'STRENGTH',
  'ENDURANCE',
  'GENERAL_HEALTH',
  'REHABILITATION',
  'MAINTENANCE',
] as const;

// Optional target weight: blank input ('' / null / undefined) → undefined; else coerce + validate.
const optionalWeight = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().positive('Must be greater than 0').max(500, 'Too large').optional(),
);

// Optional target date: blank → undefined; else must be a real YYYY-MM-DD.
const optionalDate = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z
    .string()
    .regex(DATE_RE, 'Use YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')
    .optional(),
);

export const goalFormSchema = z.object({
  goalType: z.enum(GOAL_TYPES),
  targetWeightKg: optionalWeight,
  targetDate: optionalDate,
});

export type GoalFormInput = z.input<typeof goalFormSchema>;
export type GoalFormOutput = z.output<typeof goalFormSchema>;

/** Parsed, validated form output → domain GoalInput (persistence shape). */
export function toGoalInput(values: GoalFormOutput): GoalInput {
  return {
    goalType: values.goalType,
    targetWeightKg: values.targetWeightKg ?? null,
    targetDate: values.targetDate ?? null,
  };
}

/** Existing active goal → form defaults (edit prefill). Numbers become strings for inputs. */
export function goalToFormValues(goal: Goal | null): GoalFormInput {
  const numStr = (n: number | null | undefined): string =>
    n === null || n === undefined ? '' : String(n);
  return {
    goalType: goal?.goalType ?? 'GENERAL_HEALTH',
    targetWeightKg: numStr(goal?.targetWeightKg) as unknown as GoalFormInput['targetWeightKg'],
    targetDate: goal?.targetDate ?? '',
  };
}
