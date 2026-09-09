import { z } from 'zod';

import type { WellnessSafetyProfile } from '../domain/wellness-safety-profile';
import {
  isCalendarDate,
  type WellnessSafetyProfileInput,
} from '../domain/wellness-safety-profile.rules';

/**
 * Capture-form validation for the Wellness Safety Profile (ADR-P017 **W-3**).
 *
 * Zod is the single validation source of truth for the form, exactly as the
 * progress / goal / profile forms do it. It deliberately **mirrors** the shipped
 * W-2 domain rules rather than replacing them: `normalizeProfileInput` remains
 * the authority and still fails closed on the server-bound write, so the schema
 * exists to give the user an immediate, localized, field-level message instead
 * of a save failure.
 *
 * Two rules are mirrored here because they are the two a person can get wrong:
 *
 * - **A completed evaluation needs its date; "not yet" must not carry one.**
 *   The same coupling both databases CHECK, in both directions.
 * - **The date must be a real calendar date and must not be in the future.**
 *   `today` is the **device-local** calendar date, injected by the caller — a
 *   clock is never read in here (`.ai/06_MOBILE.md`: business logic out of the
 *   UI), and the same value is handed to the service so the form and the domain
 *   agree on what "today" means.
 *
 * **Token membership is deliberately not re-validated here.** The chips can only
 * emit tokens from the closed vocabularies, and the domain validates membership
 * fail-closed for anything else; duplicating the allowlist in the presentation
 * layer would invent a second source of truth (and a user-facing message for a
 * path the UI cannot reach).
 *
 * There is **no free-text field of any kind** — no provider, finding,
 * diagnosis, condition, medication, treatment, instruction, severity, dosage,
 * document or note. The form's whole surface is one yes/no answer, one date and
 * two multi-selects over authored labels.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Localizable validation messages. The rules themselves are fixed. */
export interface WellnessSafetyFormMessages {
  dateRequired: string;
  dateFormat: string;
  validDate: string;
  dateNotFuture: string;
}

const DEFAULT_MESSAGES: WellnessSafetyFormMessages = {
  dateRequired: 'Add the date of the evaluation',
  dateFormat: 'Use the date format YYYY-MM-DD',
  validDate: 'Enter a real calendar date',
  dateNotFuture: 'The date cannot be in the future',
};

/** `'yes' | 'no'` rather than a boolean: the shared `FormSelect` holds strings. */
export const EVALUATION_COMPLETED_VALUES = ['yes', 'no'] as const;
export type EvaluationCompletedValue = (typeof EVALUATION_COMPLETED_VALUES)[number];

export function createWellnessSafetyFormSchema(
  today: string,
  messages: WellnessSafetyFormMessages = DEFAULT_MESSAGES,
) {
  return z
    .object({
      evaluationCompleted: z.enum(EVALUATION_COMPLETED_VALUES),
      evaluationDate: z.string(),
      affectedAreas: z.array(z.string()),
      movementsToAvoid: z.array(z.string()),
    })
    .superRefine((values, ctx) => {
      const date = values.evaluationDate.trim();

      if (values.evaluationCompleted === 'no') {
        // Nothing to check: an unanswered evaluation carries no date, and the
        // mapper below drops whatever the field happens to hold.
        return;
      }
      if (date.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: messages.dateRequired,
          path: ['evaluationDate'],
        });
        return;
      }
      if (!DATE_RE.test(date)) {
        ctx.addIssue({ code: 'custom', message: messages.dateFormat, path: ['evaluationDate'] });
        return;
      }
      if (!isCalendarDate(date)) {
        // Shape alone accepts 2026-02-31; the domain's calendar check does not.
        ctx.addIssue({ code: 'custom', message: messages.validDate, path: ['evaluationDate'] });
        return;
      }
      // Lexicographic comparison is correct for zero-padded ISO dates.
      if (date > today) {
        ctx.addIssue({ code: 'custom', message: messages.dateNotFuture, path: ['evaluationDate'] });
      }
    });
}

export type WellnessSafetyFormValues = z.input<ReturnType<typeof createWellnessSafetyFormSchema>>;
export type WellnessSafetyFormOutput = z.output<ReturnType<typeof createWellnessSafetyFormSchema>>;

/** Form values → the W-2 service input. Never the reverse for labels. */
export function toProfileInput(values: WellnessSafetyFormOutput): WellnessSafetyProfileInput {
  const completed = values.evaluationCompleted === 'yes';
  return {
    evaluationCompleted: completed,
    // The strict flag/date coupling: "not yet" always persists a null date,
    // even if the field still holds text the user typed before switching.
    evaluationDate: completed ? values.evaluationDate.trim() : null,
    affectedAreas: values.affectedAreas,
    movementsToAvoid: values.movementsToAvoid,
  };
}

/**
 * The stored profile → form values, so editing starts from what is saved.
 *
 * A missing profile yields the blank form: "not yet", no date, nothing
 * selected. That blank shape is also what the **Empty** state edits, so there
 * is exactly one form in the screen rather than a create form and an edit form.
 */
export function toFormValues(profile: WellnessSafetyProfile | null): WellnessSafetyFormValues {
  return {
    evaluationCompleted: profile?.evaluationCompleted ? 'yes' : 'no',
    evaluationDate: profile?.evaluationDate ?? '',
    affectedAreas: [...(profile?.affectedAreas ?? [])],
    movementsToAvoid: [...(profile?.movementsToAvoid ?? [])],
  };
}
