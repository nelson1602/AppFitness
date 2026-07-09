import { z } from 'zod';

import type { Profile, ProfileInput } from '../domain/profile.types';

/**
 * Zod is the single validation source of truth for the profile form
 * (ADR/stack: React Hook Form + Zod). Text inputs yield strings, so the
 * schema transforms strings → typed values; `toProfileInput` then maps
 * the parsed output onto the domain `ProfileInput`. Business logic and
 * persistence stay out of the UI — the form only validates + maps.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Optional numeric: blank input ('' / null / undefined) → undefined; else coerce + validate.
const optionalNumber = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    schema.optional(),
  );

export const profileFormSchema = z.object({
  // Required for the iCoach engine (BMR/BMI + safety).
  birthDate: z
    .string()
    .regex(DATE_RE, 'Use YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  heightCm: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().positive('Must be greater than 0').max(300, 'Too large'),
  ),
  // Optional / defaulted.
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']).optional(),
  fitnessLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']),
  yearsTraining: optionalNumber(z.coerce.number().min(0, 'Cannot be negative').max(80)),
  trainingDaysPerWeek: optionalNumber(z.coerce.number().int().min(0).max(7, 'Max 7')),
  sessionDurationMins: optionalNumber(z.coerce.number().int().positive().max(600)),
  sleepHoursBaseline: optionalNumber(z.coerce.number().min(0).max(24)),
  stressLevelBaseline: optionalNumber(z.coerce.number().int().min(1).max(5, 'Scale 1–5')),
  occupation: z.string().max(120).optional(),
  equipment: z.string().optional(), // comma-separated in the UI; split in the adapter
});

export type ProfileFormInput = z.input<typeof profileFormSchema>;
export type ProfileFormOutput = z.output<typeof profileFormSchema>;

/** Parsed, validated form output → domain ProfileInput (persistence shape). */
export function toProfileInput(values: ProfileFormOutput): ProfileInput {
  const occupation = values.occupation?.trim();
  const equipment = (values.equipment ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return {
    birthDate: values.birthDate,
    heightCm: values.heightCm,
    gender: values.gender ?? null,
    fitnessLevel: values.fitnessLevel,
    activityLevel: values.activityLevel,
    yearsTraining: values.yearsTraining,
    trainingDaysPerWeek: values.trainingDaysPerWeek,
    sessionDurationMins: values.sessionDurationMins,
    sleepHoursBaseline: values.sleepHoursBaseline ?? null,
    stressLevelBaseline: values.stressLevelBaseline ?? null,
    occupation: occupation ? occupation : null,
    equipment,
  };
}

/** Existing profile → form defaults (edit prefill). Numbers become strings for inputs. */
export function profileToFormValues(profile: Profile | null): ProfileFormInput {
  const numStr = (n: number | null | undefined): string =>
    n === null || n === undefined ? '' : String(n);
  return {
    birthDate: profile?.birthDate ?? '',
    heightCm: numStr(profile?.heightCm) as unknown as ProfileFormInput['heightCm'],
    gender: profile?.gender ?? undefined,
    fitnessLevel: profile?.fitnessLevel ?? 'INTERMEDIATE',
    activityLevel: profile?.activityLevel ?? 'MODERATE',
    yearsTraining: numStr(profile?.yearsTraining) as unknown as ProfileFormInput['yearsTraining'],
    trainingDaysPerWeek: numStr(
      profile?.trainingDaysPerWeek,
    ) as unknown as ProfileFormInput['trainingDaysPerWeek'],
    sessionDurationMins: numStr(
      profile?.sessionDurationMins,
    ) as unknown as ProfileFormInput['sessionDurationMins'],
    sleepHoursBaseline: numStr(
      profile?.sleepHoursBaseline,
    ) as unknown as ProfileFormInput['sleepHoursBaseline'],
    stressLevelBaseline: numStr(
      profile?.stressLevelBaseline,
    ) as unknown as ProfileFormInput['stressLevelBaseline'],
    occupation: profile?.occupation ?? '',
    equipment: (profile?.equipment ?? []).join(', '),
  };
}
