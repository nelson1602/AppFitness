import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { type TranslationKey, useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { exerciseDisplayName } from '../application/exercise-display.service';
import { useWorkoutStore } from '../application/workout.store';
import type { CustomExercise } from '../domain/workout';
import { listBuiltInExercises } from '../infrastructure/exercise-catalog.data';
import { CustomExerciseForm } from './CustomExerciseForm';
import { CustomExerciseNote } from './CustomExerciseNote';

/**
 * Bilingual exercise library for built-in and user-authored exercises. All
 * persistence remains local-first through the workout store; this presentation
 * layer translates labels only and preserves stable catalog/category identities
 * plus user-authored names and muscle groups.
 */

const BUILT_INS = listBuiltInExercises();
const CATEGORY_KEYS: Readonly<Record<CustomExercise['category'], TranslationKey>> = {
  STRENGTH: 'workout.custom.categoryStrength',
  CARDIO: 'workout.custom.categoryCardio',
  FLEXIBILITY: 'workout.custom.categoryFlexibility',
  BODYWEIGHT: 'workout.custom.categoryBodyweight',
};
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

function SyncBadge({ syncStatus }: { syncStatus: CustomExercise['syncStatus'] }) {
  const { t } = useLocalization();
  if (syncStatus === 'conflict') {
    return (
      <AppText
        variant="caption"
        tone="warning"
        accessibilityLabel={t('workout.library.syncConflict')}
      >
        {t('workout.library.syncConflict')}
      </AppText>
    );
  }
  if (syncStatus === 'pending') {
    return (
      <AppText
        variant="caption"
        tone="muted"
        accessibilityLabel={t('workout.library.syncPendingAccessibility')}
      >
        {t('workout.library.syncPending')}
      </AppText>
    );
  }
  return null;
}

export function ExerciseLibrary() {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const {
    status,
    customExercises,
    error,
    load,
    createCustomExercise,
    updateCustomExercise,
    removeCustomExercise,
    countRoutineReferences,
  } = useWorkoutStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [refCount, setRefCount] = useState<number | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const initialLoading = status === 'loading' && customExercises.length === 0;
  const saving = status === 'saving';
  const categoryLabel = (category: CustomExercise['category']): string =>
    t(CATEGORY_KEYS[category]);
  const builtInMuscleGroup = (muscleGroup: string): string => {
    const key = MUSCLE_GROUP_KEYS[muscleGroup];
    return key ? t(key) : muscleGroup;
  };

  const onAskDelete = async (id: string) => {
    setPendingDeleteId(id);
    setRefCount(null);
    setRefCount(await countRoutineReferences(id));
  };

  const onConfirmDelete = async (id: string) => {
    if (await removeCustomExercise(id)) {
      setPendingDeleteId(null);
      setRefCount(null);
    }
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{t('workout.library.title')}</AppText>
        <AppText tone="muted">{t('workout.library.subtitle')}</AppText>
      </View>

      {error ? (
        <Banner title={t('workout.library.errorTitle')} tone="error">
          {t('workout.library.errorMessage')}
        </Banner>
      ) : null}

      <Card accessibilityLabel={t('workout.library.addAccessibility')}>
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">{t('workout.library.addTitle')}</AppText>
          <CustomExerciseForm
            existing={customExercises}
            saving={saving}
            onSubmit={createCustomExercise}
          />
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">{t('workout.library.yourExercises')}</AppText>
        {initialLoading ? (
          <AppText accessibilityLabel={t('workout.library.loadingAccessibility')}>
            {t('workout.library.loading')}
          </AppText>
        ) : customExercises.length === 0 ? (
          <AppText tone="muted">{t('workout.library.empty')}</AppText>
        ) : (
          customExercises.map((exercise) => (
            <Card
              key={exercise.id}
              accessibilityLabel={`${t('workout.library.customAccessibility')}: ${exercise.name}`}
            >
              {editingId === exercise.id ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="title">{t('workout.library.editTitle')}</AppText>
                  <CustomExerciseForm
                    initial={exercise}
                    existing={customExercises}
                    saving={saving}
                    onSubmit={(input) => updateCustomExercise(exercise.id, input)}
                    onDone={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                </View>
              ) : (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="label">{exercise.name}</AppText>
                  <AppText variant="caption" tone="muted">
                    {exercise.muscleGroup} · {categoryLabel(exercise.category)}
                  </AppText>
                  <SyncBadge syncStatus={exercise.syncStatus} />
                  <CustomExerciseNote />
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <AppButton
                      accessibilityLabel={`${t('workout.library.editAccessibility')} ${exercise.name}`}
                      testID={`custom-edit-${exercise.id}`}
                      variant="secondary"
                      onPress={() => setEditingId(exercise.id)}
                    >
                      {t('workout.library.edit')}
                    </AppButton>
                    <AppButton
                      accessibilityLabel={`${t('workout.library.deleteAccessibility')} ${exercise.name}`}
                      testID={`custom-delete-${exercise.id}`}
                      variant="text"
                      onPress={() => void onAskDelete(exercise.id)}
                    >
                      {t('workout.library.delete')}
                    </AppButton>
                  </View>

                  {pendingDeleteId === exercise.id ? (
                    <View
                      style={{
                        gap: theme.spacing.sm,
                        marginTop: theme.spacing.xs,
                        borderColor: theme.colors.outline,
                        borderRadius: theme.radius.medium,
                        borderWidth: 1,
                        padding: theme.spacing.sm,
                      }}
                    >
                      <AppText variant="caption">
                        {refCount === null
                          ? t('workout.library.checkingUsage')
                          : refCount > 0
                            ? `${t('workout.library.usedIn')} ${refCount} ${t(refCount === 1 ? 'workout.library.routineOne' : 'workout.library.routineMany')} — ${t('workout.library.referencePreserved')}`
                            : t('workout.library.notUsed')}
                      </AppText>
                      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                        <AppButton
                          accessibilityLabel={`${t('workout.library.confirmDeleteAccessibility')} ${exercise.name}`}
                          testID={`custom-delete-confirm-${exercise.id}`}
                          loading={saving}
                          onPress={() => void onConfirmDelete(exercise.id)}
                        >
                          {t('workout.library.confirmDelete')}
                        </AppButton>
                        <AppButton
                          accessibilityLabel={t('workout.library.cancelDeleteAccessibility')}
                          testID={`custom-delete-cancel-${exercise.id}`}
                          variant="text"
                          onPress={() => {
                            setPendingDeleteId(null);
                            setRefCount(null);
                          }}
                        >
                          {t('workout.custom.cancel')}
                        </AppButton>
                      </View>
                    </View>
                  ) : null}
                </View>
              )}
            </Card>
          ))
        )}
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">{t('workout.library.builtInTitle')}</AppText>
        <AppText variant="caption" tone="muted">
          {t('workout.library.builtInDescription')}
        </AppText>
        {BUILT_INS.map((exercise) => {
          const displayName = exerciseDisplayName(exercise.key, language);
          return (
            <Card
              key={exercise.id}
              accessibilityLabel={`${t('workout.library.builtInAccessibility')}: ${displayName}`}
            >
              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label">{displayName}</AppText>
                <AppText variant="caption" tone="muted">
                  {builtInMuscleGroup(exercise.muscleGroup)} · {categoryLabel(exercise.category)}
                </AppText>
              </View>
            </Card>
          );
        })}
      </View>
    </View>
  );
}
