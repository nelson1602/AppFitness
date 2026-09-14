import { foodDisplayNameForKey, type AvoidTag, type ServingUnit } from '@/features/nutrition';
import { AFFECTED_AREA_LABEL_KEY, MOVEMENT_LABEL_KEY } from '@/features/wellness';
import type {
  ActivityLevel,
  DietaryExclusionType,
  DietaryPreferenceKind,
  ExerciseCategory,
  FitnessLevel,
  Gender,
  GoalType,
} from '@/shared/infrastructure/database/types';
import type { SupportedLanguage, TranslationKey } from '@/shared/localization';

/**
 * Stored values → words, for the conflict review — ADR-P030 **C-6**.
 *
 * The presenter's allow-list decides *which* fields may be seen; it says
 * nothing about what their stored form looks like. Several allow-listed fields
 * hold **identifiers**, not prose: closed enums (`MUSCLE_GAIN`), vocabulary
 * tokens (`lower_back`), catalogue slugs (`food.chicken_breast`) and internal
 * version strings. Showing any of those raw would put storage vocabulary in
 * front of a user and would not translate at all.
 *
 * So every field is classified here, once, and the classification is total:
 *
 * - **controlled** — a closed domain, mapped through the vocabulary its own
 *   feature already ships. The tables are keyed by the domain union, so adding
 *   a value without authoring its label fails `tsc`.
 * - **catalogue** — a food key, resolved to the shipped localized food name.
 * - **internal** — a version or revision identifier. Never shown; it is not
 *   something the user decided, and there is no honest wording for it.
 * - **free text** — genuinely user-authored, verified against the input that
 *   produces it. Shown exactly as the user wrote it.
 *
 * **Nothing is prettified.** An unmapped, unknown or malformed controlled
 * value resolves to `null` and its caller renders the approved withheld
 * treatment. Under-cased identifiers, underscore-splitting and title-casing are
 * deliberately absent: a mechanically beautified identifier is still an
 * identifier, and it would silently look like real copy.
 */

// ── Controlled vocabularies, each keyed by its own domain union ──────────────

/**
 * A domain's labels. Keyed by the union, so a new member fails `tsc` until it
 * is accounted for — and `null` is how a member is accounted for when the
 * product ships no approved wording for it. Those resolve to the withheld
 * treatment, never to their stored form.
 */
type Vocabulary<T extends string> = Record<T, TranslationKey | null>;

const GENDER: Vocabulary<Gender> = {
  MALE: 'profile.gender.male',
  FEMALE: 'profile.gender.female',
  OTHER: 'profile.gender.other',
  UNDISCLOSED: 'profile.gender.undisclosed',
};

const FITNESS_LEVEL: Vocabulary<FitnessLevel> = {
  BEGINNER: 'profile.fitness.beginner',
  INTERMEDIATE: 'profile.fitness.intermediate',
  ADVANCED: 'profile.fitness.advanced',
};

const ACTIVITY_LEVEL: Vocabulary<ActivityLevel> = {
  SEDENTARY: 'profile.activity.sedentary',
  LIGHT: 'profile.activity.light',
  MODERATE: 'profile.activity.moderate',
  ACTIVE: 'profile.activity.active',
  VERY_ACTIVE: 'profile.activity.veryActive',
};

const GOAL_TYPE: Vocabulary<GoalType> = {
  FAT_LOSS: 'goal.type.fatLoss',
  MUSCLE_GAIN: 'goal.type.muscleGain',
  RECOMPOSITION: 'goal.type.recomposition',
  STRENGTH: 'goal.type.strength',
  ENDURANCE: 'goal.type.endurance',
  GENERAL_HEALTH: 'goal.type.generalHealth',
  MAINTENANCE: 'goal.type.maintenance',
  // The goal editor offers seven types and the catalogues word exactly those.
  // `REHABILITATION` exists in the domain union with no approved wording, so it
  // is declared unmapped rather than shown as its stored form.
  REHABILITATION: null,
};

const EXERCISE_CATEGORY: Vocabulary<ExerciseCategory> = {
  STRENGTH: 'workout.custom.categoryStrength',
  CARDIO: 'workout.custom.categoryCardio',
  FLEXIBILITY: 'workout.custom.categoryFlexibility',
  BODYWEIGHT: 'workout.custom.categoryBodyweight',
};

/** ADR-P014: an exclusion is either a catalogue category or one specific food. */
const EXCLUSION_TYPE: Vocabulary<DietaryExclusionType> = {
  avoid_tag: 'nutrition.preferences.categoryChoice',
  catalog_key: 'nutrition.preferences.foodChoice',
};

/** ADR-P014: the safety class behind an exclusion. */
const PREFERENCE_KIND: Vocabulary<DietaryPreferenceKind> = {
  allergy: 'nutrition.preferences.allergy',
  preference: 'nutrition.preferences.preference',
};

const AVOID_TAG: Vocabulary<AvoidTag> = {
  nut_allergy: 'nutrition.avoid.nuts',
  shellfish_allergy: 'nutrition.avoid.shellfish',
  gluten_sensitive: 'nutrition.avoid.gluten',
  lactose_sensitive: 'nutrition.avoid.lactose',
  high_sodium_sensitive: 'nutrition.avoid.sodium',
  high_purine: 'nutrition.avoid.purine',
};

const SERVING_UNIT: Vocabulary<ServingUnit> = {
  g: 'nutrition.unit.g',
  ml: 'nutrition.unit.ml',
  piece: 'nutrition.unit.piece',
  cup: 'nutrition.unit.cup',
  tbsp: 'nutrition.unit.tbsp',
  tsp: 'nutrition.unit.tsp',
  slice: 'nutrition.unit.slice',
};

// ── Per-field classification ─────────────────────────────────────────────────

export type FieldVocabulary =
  /** A closed domain: look the value up, fail closed if it is not in it. */
  | {
      readonly kind: 'controlled';
      readonly labels: Readonly<Record<string, TranslationKey | null>>;
    }
  /** A catalogue slug: resolve to the shipped localized food name. */
  | { readonly kind: 'catalogue' }
  /** A version or revision identifier: never shown. */
  | { readonly kind: 'internal' }
  /** Verified user-authored free text: shown verbatim. */
  | { readonly kind: 'free' };

/**
 * Every allow-listed field whose value is not a number, date, timestamp or
 * boolean. A field absent from this table renders through the ordinary numeric
 * or temporal path; a field present here never reaches it.
 *
 * The `free` entries are each verified against the input that produces them:
 *
 * - `name` — the custom-exercise, routine and workout-log name inputs.
 * - `muscle_group` — a plain text input on the custom-exercise form, with the
 *   placeholder "e.g. legs"; users type their own words (a shipped spec stores
 *   `mis piernas`), so it is prose, not a vocabulary token.
 * - `equipment` — a comma-separated text input on the profile form, split into
 *   a list by the form adapter. Every entry is whatever the user typed.
 */
const FIELD_VOCABULARY: Readonly<Record<string, FieldVocabulary>> = {
  gender: { kind: 'controlled', labels: GENDER },
  fitness_level: { kind: 'controlled', labels: FITNESS_LEVEL },
  activity_level: { kind: 'controlled', labels: ACTIVITY_LEVEL },
  goal_type: { kind: 'controlled', labels: GOAL_TYPE },
  category: { kind: 'controlled', labels: EXERCISE_CATEGORY },
  exclusion_type: { kind: 'controlled', labels: EXCLUSION_TYPE },
  kind: { kind: 'controlled', labels: PREFERENCE_KIND },
  avoid_tag: { kind: 'controlled', labels: AVOID_TAG },
  serving_unit_snapshot: { kind: 'controlled', labels: SERVING_UNIT },
  affected_areas: { kind: 'controlled', labels: AFFECTED_AREA_LABEL_KEY },
  movements_to_avoid: { kind: 'controlled', labels: MOVEMENT_LABEL_KEY },

  catalog_key: { kind: 'catalogue' },
  catalog_key_snapshot: { kind: 'catalogue' },

  rule_version: { kind: 'internal' },
  catalog_version_snapshot: { kind: 'internal' },
  food_revision_snapshot: { kind: 'internal' },

  name: { kind: 'free' },
  muscle_group: { kind: 'free' },
  equipment: { kind: 'free' },
};

export function vocabularyFor(field: string): FieldVocabulary | null {
  return FIELD_VOCABULARY[field] ?? null;
}

/** Exported for the spec, which checks the table against the presenter. */
export const CONTROLLED_VOCABULARIES = {
  GENDER,
  FITNESS_LEVEL,
  ACTIVITY_LEVEL,
  GOAL_TYPE,
  EXERCISE_CATEGORY,
  EXCLUSION_TYPE,
  PREFERENCE_KIND,
  AVOID_TAG,
  SERVING_UNIT,
} as const;

// ── Resolution ───────────────────────────────────────────────────────────────

export type ResolvedTerm =
  | { readonly kind: 'key'; readonly key: TranslationKey }
  | { readonly kind: 'text'; readonly text: string };

/**
 * Resolves one stored value against its field's vocabulary.
 *
 * @returns `null` when the value cannot be shown honestly — an unknown enum
 *   member, a malformed token, a catalogue key that is not in the catalogue, or
 *   any internal identifier. The caller renders the withheld treatment.
 */
export function resolveTerm(
  field: string,
  raw: unknown,
  language: SupportedLanguage,
): ResolvedTerm | null {
  const vocabulary = vocabularyFor(field);
  if (!vocabulary) return null;

  switch (vocabulary.kind) {
    case 'internal':
      return null;
    case 'free':
      // Only ever reached for the three verified free-text fields, and only for
      // a value that really is a string.
      return typeof raw === 'string' && raw.trim() !== '' ? { kind: 'text', text: raw } : null;
    case 'catalogue': {
      if (typeof raw !== 'string') return null;
      const name = foodDisplayNameForKey(raw, language);
      return name ? { kind: 'text', text: name } : null;
    }
    case 'controlled': {
      if (typeof raw !== 'string') return null;
      // A member with no approved wording is as unshowable as an unknown one.
      const key = vocabulary.labels[raw] ?? null;
      return key ? { kind: 'key', key } : null;
    }
  }
}
