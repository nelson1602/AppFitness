import { z } from 'zod';

import type { RestrictionInput } from '../domain/medical.types';
import { todayIso } from './evaluation-form.schema';

/**
 * Zod is the single validation source of truth for the restriction form
 * (same approach as the evaluation/profile/goal forms). `toRestrictionInput`
 * maps parsed output onto the domain `RestrictionInput`.
 *
 * The free-text `notes` field is an ordinary optional string HERE — it is
 * encrypted downstream by the medical repository before touching SQLite
 * (ADR-P001). This form never persists, logs, or transforms it beyond
 * trimming.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const optionalText = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().max(2000).optional(),
);

const optionalDate = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z
    .string()
    .regex(DATE_RE, 'Use YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')
    .optional(),
);

export const RESTRICTION_TYPES = ['INJURY', 'CONDITION', 'DOCTOR_RESTRICTION'] as const;
export const RESTRICTION_SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'] as const;

export const restrictionFormSchema = z.object({
  type: z.enum(RESTRICTION_TYPES),
  bodyArea: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.string().max(120).optional(),
  ),
  severity: z.enum(RESTRICTION_SEVERITIES).optional(),
  notes: optionalText,
  effectiveFrom: optionalDate,
  effectiveUntil: optionalDate,
});

export type RestrictionFormInput = z.input<typeof restrictionFormSchema>;
export type RestrictionFormOutput = z.output<typeof restrictionFormSchema>;

/** Create-mode defaults: injury type, effective from today. */
export function restrictionFormDefaults(): RestrictionFormInput {
  return {
    type: 'INJURY',
    bodyArea: '',
    severity: undefined,
    notes: '',
    effectiveFrom: todayIso(),
    effectiveUntil: '',
  };
}

/** Parsed, validated form output → domain RestrictionInput (persistence shape). */
export function toRestrictionInput(values: RestrictionFormOutput): RestrictionInput {
  const text = (v: string | undefined): string | null => {
    const t = v?.trim();
    return t ? t : null;
  };
  return {
    type: values.type,
    bodyArea: text(values.bodyArea),
    severity: values.severity ?? null,
    notes: text(values.notes),
    effectiveFrom: values.effectiveFrom ?? null,
    effectiveUntil: values.effectiveUntil ?? null,
  };
}
