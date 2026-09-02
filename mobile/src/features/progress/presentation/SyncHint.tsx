import { useLocalization } from '@/shared/localization';
import type { SyncStatus } from '@/shared/infrastructure/database/types';
import { AppText } from '@/shared/presentation';

/**
 * Row-level local-first state for a listed progress entry (BUG-011). Every
 * progress write lands `pending` and the rows expose the field, but the screen
 * rendered nothing for it — so a queued or diverged entry looked identical to a
 * fully synced one on the product's most staleness-sensitive surface.
 *
 * Pending reassures (`muted`): the write is safely stored on device. Conflict is
 * `warning`, never `error`, because both versions are preserved
 * (`.ai/08_UI_UX.md` distinctions 4 and 5). Conflict is report-only — no
 * resolution flow is authorized anywhere in v1 (BUG-012).
 *
 * Shared by `ProgressScreen` and `WeeklySnapshotSummary` so the two listed row
 * kinds cannot drift apart. Per `.ai/19_COPY_DECKS.md` this belongs to listed
 * rows only, never to the aggregate dashboard card (surface 4).
 */
export function SyncHint({ syncStatus }: { syncStatus: SyncStatus }) {
  const { t } = useLocalization();
  if (syncStatus === 'conflict') {
    return (
      <AppText
        variant="caption"
        tone="warning"
        accessibilityLabel={t('progress.syncConflictAccessibility')}
      >
        {t('progress.syncConflict')}
      </AppText>
    );
  }
  if (syncStatus === 'pending') {
    return (
      <AppText
        variant="caption"
        tone="muted"
        accessibilityLabel={t('progress.syncPendingAccessibility')}
      >
        {t('progress.syncPending')}
      </AppText>
    );
  }
  return null;
}
