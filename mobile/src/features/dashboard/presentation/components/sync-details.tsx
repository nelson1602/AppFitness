import { View } from 'react-native';

import {
  interpolate,
  formatNumber,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { UNREADABLE_PAYLOAD } from '@/shared/infrastructure/sync';
import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { SyncSummary, UnsyncedChange } from '../../domain/dashboard.types';

const RECORD_NAME: Partial<Record<string, TranslationKey>> = {
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
  weekly_plans: 'sync.conflicts.record.weekly_plans',
};

/**
 * Why one queued change has not reached the server yet, in words: still
 * waiting, the session, the server, the connection, or a change this device
 * cannot read. `lastError` is the worker's technical code, never shown raw.
 */
export function unsyncedReasonKey(change: UnsyncedChange): TranslationKey {
  const error = change.lastError ?? '';
  if (change.status !== 'FAILED' || error === '') return 'dashboard.sync.details.waiting';
  if (error.startsWith(UNREADABLE_PAYLOAD)) return 'dashboard.sync.details.unreadable';
  if (error === 'http_401') return 'dashboard.sync.details.session';
  if (error.startsWith('http_')) return 'dashboard.sync.details.server';
  return 'dashboard.sync.details.network';
}

/** Whether Perfil should list what is stuck: after a failed run or a failed row. */
export function shouldShowSyncDetails(sync: SyncSummary): boolean {
  return (sync.status === 'error' || sync.failed > 0) && (sync.unsynced?.length ?? 0) > 0;
}

/**
 * v8.1: the changes still waiting to sync and why, under Perfil's sync row,
 * so a stuck queue is never just a number.
 */
export function SyncDetails({ sync }: { sync: SyncSummary }) {
  const { colors, radius, spacing } = useTheme();
  const { language, t } = useLocalization();
  const changes = sync.unsynced ?? [];

  return (
    <View
      style={{
        backgroundColor: colors.glassFill,
        borderColor: colors.glassBorder,
        borderRadius: radius.large,
        borderWidth: 1,
        gap: spacing.sm,
        padding: spacing.md,
      }}
      testID="sync-details"
    >
      <AppText tone="onStage" variant="label">
        {t('dashboard.sync.details.title')}
      </AppText>
      {changes.map((change, index) => {
        const name = RECORD_NAME[change.entityType];
        const retries =
          change.retryCount > 0
            ? ` · ${interpolate(t('dashboard.sync.details.retries'), {
                count: formatNumber(change.retryCount, language),
              })}`
            : '';
        return (
          <View key={`${change.entityType}-${index}`} testID={`sync-details-row-${index}`}>
            <AppText tone="onStage" variant="body">
              {name ? t(name) : t('dashboard.sync.details.otherRecord')}
            </AppText>
            <AppText tone="onStageVariant" variant="caption">
              {`${t(unsyncedReasonKey(change))}${retries}`}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
