import { z } from 'zod';

import {
  EXERCISE_CATEGORIES,
  normalizeExerciseName,
  type CustomExercise,
  type CustomExerciseInput,
} from '../domain/workout';

/**
 * Zod is the single validation source of truth for the custom-exercise form
 * (same approach as the goal/profile forms). Text inputs yield strings; the
 * schema trims/validates and `toCustomExerciseInput` maps the parsed output
 * onto the domain `CustomExerciseInput`. Name normalization mirrors the
 * repository (`normalizeExerciseName`) so the value the user confirms is the
 * value that is stored and uniqueness-checked. Owner-scoped duplicate-name
 * detection is NOT here (it needs the user's existing list) — the form does
 * that separately before submit, and the repository/DB is the final guard.
 */

const requiredName = z
  .string()
  .transform((v) => normalizeExerciseName(v))
  .refine((v) => v.length > 0, 'Required');

export const customExerciseFormSchema = z.object({
  name: requiredName,
  muscleGroup: requiredName,
  category: z.enum(EXERCISE_CATEGORIES as unknown as [string, ...string[]]),
  instructions: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional()),
});

export type CustomExerciseFormInput = z.input<typeof customExerciseFormSchema>;
export type CustomExerciseFormOutput = z.output<typeof customExerciseFormSchema>;

/** Parsed, validated form output → domain CustomExerciseInput (persistence shape). */
export function toCustomExerciseInput(values: CustomExerciseFormOutput): CustomExerciseInput {
  return {
    name: values.name,
    muscleGroup: values.muscleGroup,
    category: values.category as CustomExerciseInput['category'],
    instructions:
      values.instructions && values.instructions.length > 0 ? values.instructions : null,
  };
}

/** Existing custom exercise → form defaults (edit prefill); blank for create. */
export function customExerciseToFormValues(
  exercise: CustomExercise | null,
): CustomExerciseFormInput {
  return {
    name: exercise?.name ?? '',
    muscleGroup: exercise?.muscleGroup ?? '',
    category: exercise?.category ?? 'STRENGTH',
    instructions: exercise?.instructions ?? '',
  };
}
