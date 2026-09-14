import type {
  ConflictBlocker,
  ConflictFieldComparison,
  ConflictFieldValue,
  PresenterRefusal,
  SettlementCondition,
} from '@/shared/infrastructure/sync';
import type { TranslationKey } from '@/shared/localization';

import type { ConflictChoice } from '../application/sync-conflicts.store';

/**
 * Copy contracts for the conflict review surface — ADR-P030 **C-6**.
 *
 * Every user-visible string on this surface is selected here, by mapping a
 * copy-neutral identifier the C-4 model produces onto an approved C-5 key. No
 * component builds a string, and no model identifier is ever rendered: an
 * entity kind or field name that has no label is refused, not printed.
 *
 * The two big maps are **fail-closed**. `recordLabel` and `fieldLabel` return
 * `null` for anything unregistered, and their callers render the
 * unsupported/update-the-app treatment instead. That mirrors the presenter's
 * own allow-list: a new column or entity reaching the UI shows a truthful
 * "can't be reviewed here" rather than a raw identifier.
 */

/** The 13 registered entity types (ADR-P030 §Decision 12). Medical is absent. */
const RECORD_LABELS: Readonly<Record<string, TranslationKey>> = {
  user_profiles: 'sync.conflicts.record.user_profiles',
  goals: 'sync.conflicts.record.goals',
  body_weights: 'sync.conflicts.record.body_weights',
  body_measurements: 'sync.conflicts.record.body_measurements',
  progress_snapshots: 'sync.conflicts.record.progress_snapshots',
  dietary_preferences: 'sync.conflicts.record.dietary_preferences',
  meal_items: 'sync.conflicts.record.meal_items',
  exercises: 'sync.conflicts.record.exercises',
  routines: 'sync.conflicts.record.routines',
  routine_exercises: 'sync.conflicts.record.routine_exercises',
  workout_logs: 'sync.conflicts.record.workout_logs',
  workout_sets: 'sync.conflicts.record.workout_sets',
  wellness_safety_profiles: 'sync.conflicts.record.wellness_safety_profiles',
};

/**
 * The 75 allow-listed field identifiers — 69 shown plus the 6 excluded ones,
 * because an excluded field still renders a row saying a value exists.
 */
const FIELD_LABELS: Readonly<Record<string, TranslationKey>> = {
  activity_level: 'sync.conflicts.field.activity_level',
  affected_areas: 'sync.conflicts.field.affected_areas',
  avg_calories: 'sync.conflicts.field.avg_calories',
  avg_weight_kg: 'sync.conflicts.field.avg_weight_kg',
  avoid_tag: 'sync.conflicts.field.avoid_tag',
  birth_date: 'sync.conflicts.field.birth_date',
  body_fat_pct: 'sync.conflicts.field.body_fat_pct',
  calories_per_serving_snapshot: 'sync.conflicts.field.calories_per_serving_snapshot',
  carbs_per_serving_snapshot: 'sync.conflicts.field.carbs_per_serving_snapshot',
  catalog_key: 'sync.conflicts.field.catalog_key',
  catalog_key_snapshot: 'sync.conflicts.field.catalog_key_snapshot',
  catalog_version_snapshot: 'sync.conflicts.field.catalog_version_snapshot',
  category: 'sync.conflicts.field.category',
  chest_cm: 'sync.conflicts.field.chest_cm',
  completed: 'sync.conflicts.field.completed',
  date: 'sync.conflicts.field.date',
  description: 'sync.conflicts.field.description',
  ended_at: 'sync.conflicts.field.ended_at',
  equipment: 'sync.conflicts.field.equipment',
  evaluation_completed: 'sync.conflicts.field.evaluation_completed',
  evaluation_date: 'sync.conflicts.field.evaluation_date',
  exclusion_type: 'sync.conflicts.field.exclusion_type',
  fat_per_serving_snapshot: 'sync.conflicts.field.fat_per_serving_snapshot',
  fiber_per_serving_snapshot: 'sync.conflicts.field.fiber_per_serving_snapshot',
  finished_at: 'sync.conflicts.field.finished_at',
  fitness_level: 'sync.conflicts.field.fitness_level',
  food_name_snapshot: 'sync.conflicts.field.food_name_snapshot',
  food_revision_snapshot: 'sync.conflicts.field.food_revision_snapshot',
  gender: 'sync.conflicts.field.gender',
  goal_type: 'sync.conflicts.field.goal_type',
  grams_per_serving_snapshot: 'sync.conflicts.field.grams_per_serving_snapshot',
  height_cm: 'sync.conflicts.field.height_cm',
  hip_cm: 'sync.conflicts.field.hip_cm',
  instructions: 'sync.conflicts.field.instructions',
  is_active: 'sync.conflicts.field.is_active',
  is_deload_week: 'sync.conflicts.field.is_deload_week',
  kind: 'sync.conflicts.field.kind',
  left_arm_cm: 'sync.conflicts.field.left_arm_cm',
  movements_to_avoid: 'sync.conflicts.field.movements_to_avoid',
  muscle_group: 'sync.conflicts.field.muscle_group',
  muscle_mass_kg: 'sync.conflicts.field.muscle_mass_kg',
  name: 'sync.conflicts.field.name',
  neck_cm: 'sync.conflicts.field.neck_cm',
  note: 'sync.conflicts.field.note',
  notes: 'sync.conflicts.field.notes',
  occupation: 'sync.conflicts.field.occupation',
  order_index: 'sync.conflicts.field.order_index',
  protein_per_serving_snapshot: 'sync.conflicts.field.protein_per_serving_snapshot',
  reps: 'sync.conflicts.field.reps',
  right_arm_cm: 'sync.conflicts.field.right_arm_cm',
  rpe: 'sync.conflicts.field.rpe',
  rule_version: 'sync.conflicts.field.rule_version',
  serving_amount_snapshot: 'sync.conflicts.field.serving_amount_snapshot',
  serving_count: 'sync.conflicts.field.serving_count',
  serving_unit_snapshot: 'sync.conflicts.field.serving_unit_snapshot',
  session_duration_mins: 'sync.conflicts.field.session_duration_mins',
  set_number: 'sync.conflicts.field.set_number',
  sleep_hours_baseline: 'sync.conflicts.field.sleep_hours_baseline',
  started_at: 'sync.conflicts.field.started_at',
  stress_level_baseline: 'sync.conflicts.field.stress_level_baseline',
  target_calories: 'sync.conflicts.field.target_calories',
  target_carbs_g: 'sync.conflicts.field.target_carbs_g',
  target_date: 'sync.conflicts.field.target_date',
  target_fat_g: 'sync.conflicts.field.target_fat_g',
  target_protein_g: 'sync.conflicts.field.target_protein_g',
  target_reps: 'sync.conflicts.field.target_reps',
  target_sets: 'sync.conflicts.field.target_sets',
  target_weight_kg: 'sync.conflicts.field.target_weight_kg',
  total_volume_kg: 'sync.conflicts.field.total_volume_kg',
  training_days_per_week: 'sync.conflicts.field.training_days_per_week',
  waist_cm: 'sync.conflicts.field.waist_cm',
  week_start: 'sync.conflicts.field.week_start',
  weight_kg: 'sync.conflicts.field.weight_kg',
  workout_count: 'sync.conflicts.field.workout_count',
  years_training: 'sync.conflicts.field.years_training',
};

/**
 * The label for a registered entity type, or `null` when the type has none.
 * Never falls back to the identifier: an unlabelled kind is refused upstream.
 */
export function recordLabel(entityKind: string): TranslationKey | null {
  return RECORD_LABELS[entityKind] ?? null;
}

/** The label for an allow-listed field, or `null` when the field has none. */
export function fieldLabel(field: string): TranslationKey | null {
  return FIELD_LABELS[field] ?? null;
}

/** One short chip per settlement condition (ADR-P030 §Decision 6). */
export const SETTLEMENT_CHIP: Readonly<Record<SettlementCondition, TranslationKey>> = {
  UNDECIDED: 'sync.conflicts.status.undecided',
  CHOICE_RECORDED: 'sync.conflicts.status.choiceRecorded',
  RETRYING: 'sync.conflicts.status.retrying',
  BLOCKED: 'sync.conflicts.status.blocked',
  SETTLED: 'sync.conflicts.status.settled',
};

/**
 * A side that carries no shown value. `hidden` states that a value exists and
 * is not shown; `absent` states that this side carries none at all. They are
 * never collapsed — reading `hidden` as empty would misdescribe the data.
 */
export const VALUE_STATE: Readonly<
  Record<Exclude<ConflictFieldValue['state'], 'value'>, TranslationKey>
> = {
  hidden: 'sync.conflicts.value.hidden',
  absent: 'sync.conflicts.value.absent',
};

/** The comparison marker. Text, so nothing depends on colour. */
export const COMPARISON: Readonly<Record<ConflictFieldComparison['comparison'], TranslationKey>> = {
  same: 'sync.conflicts.compare.same',
  different: 'sync.conflicts.compare.different',
  unknown: 'sync.conflicts.compare.unknown',
};

/** The two sides, distinguishable in text at any size and with no colour. */
export const SIDE = {
  local: 'sync.conflicts.side.thisDevice',
  server: 'sync.conflicts.side.account',
} as const satisfies Record<'local' | 'server', TranslationKey>;

export interface ChoiceCopy {
  readonly label: TranslationKey;
  readonly description: TranslationKey;
  readonly accessibility: TranslationKey;
}

/** Both labels read unambiguously alone, out of context and with no colour. */
export const CHOICE_COPY: Readonly<Record<ConflictChoice, ChoiceCopy>> = {
  RESOLVED_LOCAL_WINS: {
    label: 'sync.conflicts.choice.keepThisDevice',
    description: 'sync.conflicts.choice.keepThisDeviceDescription',
    accessibility: 'sync.conflicts.choice.keepThisDeviceAccessibility',
  },
  RESOLVED_SERVER_WINS: {
    label: 'sync.conflicts.choice.keepAccount',
    description: 'sync.conflicts.choice.keepAccountDescription',
    accessibility: 'sync.conflicts.choice.keepAccountAccessibility',
  },
};

export interface NoticeCopy {
  readonly title: TranslationKey;
  readonly body: TranslationKey;
}

/** Why a listed conflict cannot be decided here (ADR-P030 §Decisions 9, 12). */
export const BLOCKER_COPY: Readonly<Record<ConflictBlocker, NoticeCopy>> = {
  REMOTE_ORIGIN: {
    title: 'sync.conflicts.blocked.remoteTitle',
    body: 'sync.conflicts.blocked.remoteBody',
  },
  UNSUPPORTED_ENTITY: {
    title: 'sync.conflicts.blocked.unsupportedTitle',
    body: 'sync.conflicts.blocked.unsupportedBody',
  },
  ENCRYPTED_PAYLOAD: {
    title: 'sync.conflicts.blocked.unreadableTitle',
    body: 'sync.conflicts.blocked.unreadableBody',
  },
};

/** Why the fail-closed presenter refused to show this conflict at all. */
export const REFUSAL_COPY: Readonly<Record<PresenterRefusal, NoticeCopy>> = {
  UNKNOWN_ENTITY: {
    title: 'sync.conflicts.blocked.unsupportedTitle',
    body: 'sync.conflicts.blocked.unsupportedBody',
  },
  UNKNOWN_FIELD: {
    title: 'sync.conflicts.blocked.updateAppTitle',
    body: 'sync.conflicts.blocked.updateAppBody',
  },
  MALFORMED_PAYLOAD: {
    title: 'sync.conflicts.blocked.unreadableTitle',
    body: 'sync.conflicts.blocked.unreadableBody',
  },
};
