import { WEEKDAY_KEYS, WEEKDAYS } from '@/features/workout/presentation/weekday-labels';
import {
  formatKcal,
  interpolate,
  type SupportedLanguage,
  type TranslationKey,
} from '@/shared/localization';

import type { CoachChange } from '../domain/realtime-recalc';
import { dayIndexInWeek } from '../domain/week';

type Translate = (key: TranslationKey) => string;

const MUSCLE_KEYS: Readonly<Record<string, TranslationKey>> = {
  back: 'workout.muscle.back',
  chest: 'workout.muscle.chest',
  core: 'workout.muscle.core',
  full_body: 'workout.muscle.fullBody',
  glutes: 'workout.muscle.glutes',
  hamstrings: 'workout.muscle.hamstrings',
  quadriceps: 'workout.muscle.quadriceps',
  shoulders: 'workout.muscle.shoulders',
  triceps: 'workout.muscle.triceps',
};

/** Spanish names weekdays and muscles in lower case inside a sentence. */
function inSentence(text: string, language: SupportedLanguage): string {
  return language === 'es' ? text.toLocaleLowerCase('es') : text;
}

/** The weekday of a `YYYY-MM-DD` date, as it reads inside a sentence. */
export function weekdayInSentence(date: string, t: Translate, language: SupportedLanguage) {
  return inSentence(t(WEEKDAY_KEYS[WEEKDAYS[dayIndexInWeek(date)]]), language);
}

/** Muscle groups as a list inside a sentence ("cuádriceps, glúteos"). */
export function muscleGroupsInSentence(
  groups: readonly string[],
  t: Translate,
  language: SupportedLanguage,
): string {
  return groups
    .map((group) => {
      const key = MUSCLE_KEYS[group];
      return key ? inSentence(t(key), language) : group;
    })
    .join(', ');
}

/** ADR-P040 Addendum v10-A R5: the iCoach's latest change in one sentence. */
export function coachChangeText(
  change: CoachChange,
  t: Translate,
  language: SupportedLanguage,
): string {
  switch (change.kind) {
    case 'activityBonus':
      return interpolate(t('home.coach.change.activityBonus'), {
        kcal: formatKcal(change.kcal, language),
      });
    case 'lightened':
      return interpolate(t('home.coach.change.lightened'), {
        day: weekdayInSentence(change.date, t, language),
        groups: muscleGroupsInSentence(change.groups, t, language),
      });
    case 'moved':
      return interpolate(t('home.coach.change.moved'), {
        from: weekdayInSentence(change.from, t, language),
        to: weekdayInSentence(change.to, t, language),
      });
    case 'planUpdated':
      return t('home.coach.change.planUpdated');
  }
}
