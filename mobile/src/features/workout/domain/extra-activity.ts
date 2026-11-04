import type { ExerciseCategory } from '@/shared/infrastructure/database/types';

/**
 * Extra activity (ADR-P040 Addendum v10-A, rule `extra-activity@1.0.0`): what a
 * logged workout is (cardio or strength, which muscle groups), how long it
 * lasted and how many kcal it burned. Pure and deterministic: no clock, store
 * or database; identical inputs always give the identical activity.
 *
 * - **Type**: the logged sets decide first (the catalog category of their
 *   exercises; strength wins a tie). Without sets, a fixed keyword table on
 *   the name (accents and case ignored, whole words only). Otherwise `other`.
 * - **Minutes**: minutes the person wrote in the name ("Correr 15 min",
 *   "Bici 1 h"); else the time between start and finish; else 2 minutes per
 *   logged set; else unknown. Clamped to 1–240.
 * - **kcal**: NET kcal = (MET − 1) × kg × hours, rounded (the resting 1 MET is
 *   already in the day's target, so it is never counted twice). MET values
 *   from the 2011 Compendium of Physical Activities, the conservative row of
 *   each family. Unknown minutes or weight → no kcal.
 */
export const EXTRA_ACTIVITY_RULE_VERSION = 'extra-activity@1.0.0';

export type ActivityType =
  | 'running'
  | 'walking'
  | 'cycling'
  | 'swimming'
  | 'cardio'
  | 'strength'
  | 'bodyweight'
  | 'flexibility'
  | 'other';

export type ActivityKind = 'cardio' | 'strength' | 'other';

/** Compendium 2011 METs (codes 12020, 17190, 01015, 18310, 03015, 02054, 02020, 02101). */
export const ACTIVITY_MET: Readonly<Record<ActivityType, number>> = {
  running: 8.0,
  walking: 3.5,
  cycling: 7.5,
  swimming: 6.0,
  cardio: 6.0,
  strength: 3.5,
  bodyweight: 3.8,
  flexibility: 2.5,
  other: 1,
};

export const ACTIVITY_KIND: Readonly<Record<ActivityType, ActivityKind>> = {
  running: 'cardio',
  walking: 'cardio',
  cycling: 'cardio',
  swimming: 'cardio',
  cardio: 'cardio',
  strength: 'strength',
  bodyweight: 'strength',
  flexibility: 'other',
  other: 'other',
};

export const MIN_ACTIVITY_MINUTES = 1;
export const MAX_ACTIVITY_MINUTES = 240;
/** Minutes per logged set when nothing else says how long it took (≈45 s work + 75 s rest). */
export const MINUTES_PER_SET = 2;

/** Whole-word keywords, matched in this order (the first family that matches wins). */
const NAME_KEYWORDS: readonly (readonly [ActivityType, readonly string[]])[] = [
  [
    'running',
    ['correr', 'corri', 'trotar', 'trote', 'carrera', 'run', 'running', 'jog', 'jogging'],
  ],
  ['walking', ['caminar', 'caminata', 'camine', 'senderismo', 'walk', 'walking', 'hike', 'hiking']],
  ['cycling', ['bici', 'bicicleta', 'ciclismo', 'spinning', 'bike', 'cycling']],
  ['swimming', ['nadar', 'natacion', 'swim', 'swimming']],
  [
    'cardio',
    [
      'cardio',
      'eliptica',
      'elliptical',
      'remo',
      'rowing',
      'baile',
      'bailar',
      'dance',
      'zumba',
      'hiit',
    ],
  ],
  [
    'strength',
    [
      'pesas',
      'levantamiento',
      'fuerza',
      'gym',
      'gimnasio',
      'weights',
      'weightlifting',
      'strength',
      'lifting',
      'pierna',
      'piernas',
      'pecho',
      'espalda',
      'brazos',
      'hombros',
      'legs',
      'chest',
      'back',
      'arms',
      'shoulders',
    ],
  ],
  [
    'flexibility',
    ['yoga', 'estiramiento', 'estirar', 'stretch', 'stretching', 'pilates', 'movilidad'],
  ],
];

/** Muscle groups a strength name names; none named means the whole body. */
const NAME_MUSCLES: readonly (readonly [readonly string[], readonly string[]])[] = [
  [
    ['pierna', 'piernas', 'legs'],
    ['quadriceps', 'hamstrings', 'glutes'],
  ],
  [
    ['pecho', 'chest'],
    ['chest', 'triceps'],
  ],
  [['espalda', 'back'], ['back']],
  [
    ['brazos', 'arms'],
    ['triceps', 'back'],
  ],
  [['hombros', 'shoulders'], ['shoulders']],
];

/** Every muscle group: what an unnamed strength workout is assumed to load. */
export const FULL_BODY = 'full_body';

export interface ActivityLogInput {
  id: string;
  name: string;
  /** ISO instants. */
  startedAt: string;
  finishedAt: string | null;
  /** Device-local `YYYY-MM-DD` the workout started. */
  localDate: string;
}

export interface ActivitySetInput {
  category: ExerciseCategory;
  muscleGroup: string;
}

export interface ExtraActivity {
  id: string;
  name: string;
  date: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'done' | 'in_progress';
  type: ActivityType;
  kind: ActivityKind;
  /** Sorted, unique; `full_body` when the groups are unknown. Empty for cardio. */
  muscleGroups: string[];
  minutes: number | null;
  kcal: number | null;
}

/** Lower case, accents removed, split into words. */
function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

export function activityTypeFromName(name: string): ActivityType {
  const tokens = new Set(words(name));
  for (const [type, keywords] of NAME_KEYWORDS) {
    if (keywords.some((keyword) => tokens.has(keyword))) return type;
  }
  return 'other';
}

function typeFromSets(sets: readonly ActivitySetInput[]): ActivityType | null {
  if (sets.length === 0) return null;
  let cardio = 0;
  let strength = 0;
  let bodyweight = 0;
  let flexibility = 0;
  for (const set of sets) {
    if (set.category === 'CARDIO') cardio += 1;
    else if (set.category === 'STRENGTH') strength += 1;
    else if (set.category === 'BODYWEIGHT') bodyweight += 1;
    else flexibility += 1;
  }
  const lifting = strength + bodyweight;
  if (lifting >= cardio && lifting >= flexibility && lifting > 0) {
    return strength >= bodyweight ? 'strength' : 'bodyweight';
  }
  return cardio >= flexibility ? 'cardio' : 'flexibility';
}

/** Minutes written in the name: "15 min", "20 minutos", "1 h", "1 hora". */
export function minutesFromName(name: string): number | null {
  const text = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const minutes = /(\d{1,3})\s*(?:min|mins|minuto|minutos|minute|minutes)\b/.exec(text);
  if (minutes) return Number(minutes[1]);
  const hours = /(\d)\s*(?:h|hr|hrs|hora|horas|hour|hours)\b/.exec(text);
  if (hours) return Number(hours[1]) * 60;
  return null;
}

function clampMinutes(minutes: number): number {
  return Math.min(MAX_ACTIVITY_MINUTES, Math.max(MIN_ACTIVITY_MINUTES, Math.round(minutes)));
}

export function activityMinutes(log: ActivityLogInput, setCount: number): number | null {
  const named = minutesFromName(log.name);
  if (named !== null && named > 0) return clampMinutes(named);
  if (log.finishedAt) {
    const elapsed = (Date.parse(log.finishedAt) - Date.parse(log.startedAt)) / 60000;
    if (Number.isFinite(elapsed) && elapsed >= 1) return clampMinutes(elapsed);
  }
  if (setCount > 0) return clampMinutes(setCount * MINUTES_PER_SET);
  return null;
}

/** NET kcal = (MET − 1) × kg × hours; null without minutes or weight. */
export function activityKcal(
  type: ActivityType,
  minutes: number | null,
  weightKg: number | null,
): number | null {
  if (minutes === null || weightKg === null || weightKg <= 0) return null;
  const net = Math.max(0, ACTIVITY_MET[type] - 1);
  return Math.round(net * weightKg * (minutes / 60));
}

function muscleGroupsFor(
  kind: ActivityKind,
  name: string,
  sets: readonly ActivitySetInput[],
): string[] {
  if (kind !== 'strength') return [];
  const fromSets = sets
    .filter((set) => set.category === 'STRENGTH' || set.category === 'BODYWEIGHT')
    .map((set) => set.muscleGroup);
  if (fromSets.length > 0) return [...new Set(fromSets)].sort();
  const tokens = new Set(words(name));
  const named = NAME_MUSCLES.filter(([keywords]) => keywords.some((k) => tokens.has(k))).flatMap(
    ([, groups]) => groups,
  );
  return named.length > 0 ? [...new Set(named)].sort() : [FULL_BODY];
}

/** One logged workout as an activity: type, groups, minutes, kcal and status. */
export function describeActivity(
  log: ActivityLogInput,
  sets: readonly ActivitySetInput[],
  weightKg: number | null,
): ExtraActivity {
  const type = typeFromSets(sets) ?? activityTypeFromName(log.name);
  const kind = ACTIVITY_KIND[type];
  const minutes = activityMinutes(log, sets.length);
  return {
    id: log.id,
    name: log.name,
    date: log.localDate,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    status: log.finishedAt ? 'done' : 'in_progress',
    type,
    kind,
    muscleGroups: muscleGroupsFor(kind, log.name, sets),
    minutes,
    kcal: activityKcal(type, minutes, weightKg),
  };
}
