import type { Weekday } from '@/features/icoach';
import type { TranslationKey } from '@/shared/localization';

export const WEEKDAYS: readonly Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const WEEKDAY_KEYS: Readonly<Record<Weekday, TranslationKey>> = {
  MONDAY: 'workout.day.monday',
  TUESDAY: 'workout.day.tuesday',
  WEDNESDAY: 'workout.day.wednesday',
  THURSDAY: 'workout.day.thursday',
  FRIDAY: 'workout.day.friday',
  SATURDAY: 'workout.day.saturday',
  SUNDAY: 'workout.day.sunday',
};

export const WEEKDAY_SHORT_KEYS: Readonly<Record<Weekday, TranslationKey>> = {
  MONDAY: 'workouts.dayShort.monday',
  TUESDAY: 'workouts.dayShort.tuesday',
  WEDNESDAY: 'workouts.dayShort.wednesday',
  THURSDAY: 'workouts.dayShort.thursday',
  FRIDAY: 'workouts.dayShort.friday',
  SATURDAY: 'workouts.dayShort.saturday',
  SUNDAY: 'workouts.dayShort.sunday',
};
