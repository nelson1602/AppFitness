import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import {
  type SupportedLanguage,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { exerciseDisplayName } from '../application/exercise-display.service';
import type { CustomExercise, Routine, RoutineExercise } from '../domain/workout';
import { useWorkoutStore } from '../application/workout.store';
import {
  getBuiltInExerciseById,
  listBuiltInExercises,
} from '../infrastructure/exercise-catalog.data';
import { CustomExerciseForm } from './CustomExerciseForm';
import { CustomExerciseNote } from './CustomExerciseNote';
import { ExerciseExclusionNote } from './ExerciseExclusionNote';
import { GeneratedWorkoutPlan } from './GeneratedWorkoutPlan';

/**
 * Routine builder (ADR-P015 Phase 16 Slice 5; TrainingPlan integration in Slice
 * 7). View / create / remove routines and manage a routine's exercises using
 * the Slice 2 built-in catalog. ALL persistence routes through the Slice 4A/4B
 * workout store → service → repository (local-first write, sync enqueue); the
 * UI never touches SQLite.
 *
 * Public-v1 iCoach output is rendered by `GeneratedWorkoutPlan`. This public
 * surface deliberately does not read the retained medical `TrainingPlan`;
 * future wellness-owned movement limitations require an explicit contract.
 */

const CATALOG = listBuiltInExercises();
const MUSCLE_GROUP_KEYS: Readonly<Record<string, TranslationKey>> = {
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

export function RoutineBuilder() {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const {
    status,
    routines,
    routineExercises,
    customExercises,
    error,
    load,
    createRoutine,
    createCustomExercise,
    deactivateRoutine,
    loadRoutineExercises,
    addRoutineExercise,
    removeRoutineExercise,
  } = useWorkoutStore();

  // Public v1 never sources limitations from the retained medical contract.
  // A future wellness-owned limitation contract can replace this empty list.
  const excludedMovements: readonly string[] = [];

  const [name, setName] = useState('');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [showNewExercise, setShowNewExercise] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const initialLoading = status === 'loading' && routines.length === 0;

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ok = await createRoutine({ name: trimmed });
    if (ok) setName('');
  };

  const onSelect = async (routine: Routine) => {
    if (selectedRoutineId === routine.id) {
      setSelectedRoutineId(null);
      return;
    }
    setSelectedRoutineId(routine.id);
    await loadRoutineExercises(routine.id);
  };

  const onAddExerciseById = (exerciseId: string) => {
    if (!selectedRoutineId) return;
    void addRoutineExercise(selectedRoutineId, {
      exerciseId,
      order: routineExercises.length,
    });
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{t('workout.builder.title')}</AppText>
        <AppText tone="muted">{t('workout.builder.subtitle')}</AppText>
      </View>

      {error ? (
        <Banner title={t('workout.builder.errorTitle')} tone="error">
          {t('workout.builder.errorMessage')}
        </Banner>
      ) : null}

      <GeneratedWorkoutPlan />

      <Card accessibilityLabel={t('workout.builder.createAccessibility')}>
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">{t('workout.builder.createTitle')}</AppText>
          <TextInput
            accessibilityLabel={t('workout.builder.name')}
            testID="routine-name"
            placeholder={t('workout.builder.namePlaceholder')}
            placeholderTextColor={theme.colors.outline}
            value={name}
            onChangeText={setName}
            style={{
              borderColor: theme.colors.outline,
              borderRadius: theme.radius.medium,
              borderWidth: 1,
              color: theme.colors.onSurface,
              padding: theme.spacing.sm,
            }}
          />
          <AppButton
            accessibilityLabel={t('workout.builder.createButton')}
            testID="routine-create"
            disabled={!name.trim()}
            loading={status === 'saving'}
            onPress={() => void onCreate()}
          >
            {t('workout.builder.createButton')}
          </AppButton>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">{t('workout.builder.yourRoutines')}</AppText>
        {initialLoading ? (
          <AppText accessibilityLabel={t('workout.builder.loadingAccessibility')}>
            {t('workout.builder.loading')}
          </AppText>
        ) : routines.length === 0 ? (
          <AppText tone="muted">{t('workout.builder.empty')}</AppText>
        ) : (
          routines.map((routine) => (
            <Card
              key={routine.id}
              accessibilityLabel={`${t('workout.builder.routineAccessibility')} ${routine.name}`}
            >
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="label">{routine.name}</AppText>
                {routine.description ? (
                  <AppText variant="caption" tone="muted">
                    {routine.description}
                  </AppText>
                ) : null}
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <AppButton
                    accessibilityLabel={`${t('workout.builder.viewExercisesAccessibility')} ${routine.name}`}
                    testID={`routine-select-${routine.id}`}
                    variant="secondary"
                    onPress={() => void onSelect(routine)}
                  >
                    {selectedRoutineId === routine.id
                      ? t('workout.builder.hideExercises')
                      : t('workout.builder.viewExercises')}
                  </AppButton>
                  <AppButton
                    accessibilityLabel={`${t('workout.builder.removeRoutineAccessibility')} ${routine.name}`}
                    testID={`routine-remove-${routine.id}`}
                    variant="text"
                    loading={status === 'saving'}
                    onPress={() => void deactivateRoutine(routine.id)}
                  >
                    {t('workout.builder.remove')}
                  </AppButton>
                </View>

                {selectedRoutineId === routine.id ? (
                  <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
                    <ExerciseList
                      exercises={routineExercises}
                      excludedMovements={excludedMovements}
                      customExercises={customExercises}
                      language={language}
                      onRemove={(id) => void removeRoutineExercise(id)}
                      removing={status === 'saving'}
                    />
                    <AppText variant="label" tone="muted">
                      {t('workout.builder.addExercise')}
                    </AppText>

                    {showNewExercise ? (
                      <Card accessibilityLabel={t('workout.builder.newCustomAccessibility')}>
                        <CustomExerciseForm
                          existing={customExercises}
                          saving={status === 'saving'}
                          onSubmit={createCustomExercise}
                          onDone={() => setShowNewExercise(false)}
                          onCancel={() => setShowNewExercise(false)}
                        />
                      </Card>
                    ) : (
                      <AppButton
                        accessibilityLabel={t('workout.builder.createCustomAccessibility')}
                        testID="routine-new-custom-exercise"
                        variant="secondary"
                        onPress={() => setShowNewExercise(true)}
                      >
                        {t('workout.builder.newExercise')}
                      </AppButton>
                    )}

                    <AppText variant="caption" tone="muted">
                      {t('workout.builder.builtIn')}
                    </AppText>
                    <View style={{ gap: theme.spacing.sm }}>
                      {CATALOG.map((exercise) => {
                        const displayName = exerciseDisplayName(exercise.key, language);
                        const muscleKey = MUSCLE_GROUP_KEYS[exercise.muscleGroup];
                        return (
                          <Pressable
                            key={exercise.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('workout.builder.addAccessibility')} ${displayName}`}
                            testID={`add-exercise-${exercise.key}`}
                            onPress={() => onAddExerciseById(exercise.id)}
                            style={{
                              borderColor: theme.colors.outline,
                              borderRadius: theme.radius.medium,
                              borderWidth: 1,
                              padding: theme.spacing.sm,
                            }}
                          >
                            <AppText>{displayName}</AppText>
                            <AppText variant="caption" tone="muted">
                              {muscleKey ? t(muscleKey) : exercise.muscleGroup}
                            </AppText>
                            <ExerciseExclusionNote
                              exercise={exercise}
                              excludedMovements={excludedMovements}
                            />
                          </Pressable>
                        );
                      })}
                    </View>

                    <AppText variant="caption" tone="muted">
                      {t('workout.builder.myExercises')}
                    </AppText>
                    {customExercises.length === 0 ? (
                      <AppText tone="muted">{t('workout.builder.customEmpty')}</AppText>
                    ) : (
                      <View style={{ gap: theme.spacing.sm }}>
                        {customExercises.map((exercise) => (
                          <Pressable
                            key={exercise.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('workout.builder.addAccessibility')} ${exercise.name}`}
                            testID={`add-custom-exercise-${exercise.id}`}
                            onPress={() => onAddExerciseById(exercise.id)}
                            style={{
                              borderColor: theme.colors.outline,
                              borderRadius: theme.radius.medium,
                              borderWidth: 1,
                              padding: theme.spacing.sm,
                            }}
                          >
                            <AppText>{exercise.name}</AppText>
                            <AppText variant="caption" tone="muted">
                              {exercise.muscleGroup}
                            </AppText>
                            <CustomExerciseNote />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </View>
    </View>
  );
}

function ExerciseList({
  exercises,
  excludedMovements,
  customExercises,
  language,
  onRemove,
  removing,
}: {
  exercises: RoutineExercise[];
  excludedMovements: readonly string[];
  customExercises: readonly CustomExercise[];
  language: SupportedLanguage;
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const theme = useTheme();
  const { t } = useLocalization();
  if (exercises.length === 0) {
    return <AppText tone="muted">{t('workout.builder.routineExerciseEmpty')}</AppText>;
  }
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {exercises.map((re) => {
        // A built-in resolves from the catalog; a custom from the loaded list;
        // a removed/not-yet-loaded custom shows "(removed exercise)".
        const exercise = getBuiltInExerciseById(re.exerciseId);
        const displayName = exercise
          ? exerciseDisplayName(exercise.key, language)
          : (customExercises.find((candidate) => candidate.id === re.exerciseId)?.name ??
            t('workout.builder.removedExercise'));
        return (
          <View key={re.id} testID={`routine-exercise-${re.id}`} style={{ gap: theme.spacing.xs }}>
            <AppText variant="label">{displayName}</AppText>
            <ExerciseExclusionNote exercise={exercise} excludedMovements={excludedMovements} />
            <AppButton
              accessibilityLabel={`${t('workout.builder.removeFromRoutineAccessibility')} ${displayName}`}
              testID={`routine-exercise-remove-${re.id}`}
              variant="text"
              loading={removing}
              onPress={() => onRemove(re.id)}
            >
              {t('workout.builder.remove')}
            </AppButton>
          </View>
        );
      })}
    </View>
  );
}
