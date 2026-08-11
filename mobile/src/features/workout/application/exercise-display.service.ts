import type { SupportedLanguage } from '@/shared/localization';

import { getBuiltInExercise } from '../infrastructure/exercise-catalog.data';
import { SPANISH_EXERCISE_NAMES } from '../infrastructure/exercise-catalog.es';

/** Resolves locale-specific copy without changing the exercise's stable key. */
export function exerciseDisplayName(exerciseKey: string, language: SupportedLanguage): string {
  const exercise = getBuiltInExercise(exerciseKey);
  if (!exercise) return exerciseKey;
  return language === 'es' ? (SPANISH_EXERCISE_NAMES[exerciseKey] ?? exercise.name) : exercise.name;
}
