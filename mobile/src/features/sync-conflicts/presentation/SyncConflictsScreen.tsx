import { useEffect } from 'react';
import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import {
  useSyncConflictsStore,
  type SyncConflictsNotice,
} from '../application/sync-conflicts.store';
import { SIDE, type NoticeCopy } from './conflict-copy';
import { ConflictCard } from './components/conflict-card';

/**
 * Conflict review and resolution — ADR-P030 **C-6**, the `/sync-conflicts`
 * surface.
 *
 * The single canonical **Conflict** state (`.ai/08_UI_UX.md`), composed with
 * the ordinary Loading / Empty / Error / Web-unavailable arms every other
 * surface uses. No ninth state is introduced: a recorded-but-unsettled choice
 * is content inside the ready arm, wearing the reassuring Pending-sync tone.
 *
 * The screen binds only to the store's public API. It reaches no service, no
 * transport and no database, and every string it renders comes from the
 * approved C-5 catalogue family.
 */
export function SyncConflictsScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status, conflicts, error, notice, busyConflictId, refresh, choose, settle } =
    useSyncConflictsStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Local database is dormant on Web (ADR-P019): a terminal, non-error
  // informational state. No retry, no fabricated data, and — because the store
  // never reaches a database that exists there — no resolution control at all.
  if (status === 'web-unavailable') {
    return (
      <Banner title={t('sync.conflicts.webUnavailableTitle')} tone="info">
        {t('sync.conflicts.webUnavailableBody')}
      </Banner>
    );
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <AppText tone="muted" testID="sync-conflicts-loading">
        {t('sync.conflicts.loading')}
      </AppText>
    );
  }

  if (status === 'error' || error !== null) {
    // A read that failed and a write that failed are different facts and get
    // different words: the load arm says the list could not be opened, the
    // choose arm says the choice was not saved and nothing changed.
    const failedToWrite = error === 'choose';
    return (
      <View style={{ gap: theme.spacing.md }}>
        <Banner
          title={t(failedToWrite ? 'sync.conflicts.choiceErrorTitle' : 'sync.conflicts.errorTitle')}
          tone="error"
        >
          {t(failedToWrite ? 'sync.conflicts.choiceErrorBody' : 'sync.conflicts.errorBody')}
        </Banner>
        <AppButton
          accessibilityLabel={t('sync.conflicts.retryAccessibility')}
          onPress={() => {
            void refresh();
          }}
          testID="sync-conflicts-retry"
          variant="secondary"
        >
          {t('sync.conflicts.retry')}
        </AppButton>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <AppText tone="muted">{t('sync.conflicts.intro')}</AppText>

      {notice ? <ActionNotice notice={notice} onReview={() => void refresh()} /> : null}

      {conflicts.length === 0 ? (
        <Banner title={t('sync.conflicts.emptyTitle')} tone="info">
          {t('sync.conflicts.emptyBody')}
        </Banner>
      ) : (
        conflicts.map((view, index) => (
          <ConflictCard
            busy={busyConflictId === view.id}
            key={view.id}
            onChoose={(conflictId, choice) => void choose(conflictId, choice)}
            onRetry={(conflictId) => void settle(conflictId)}
            position={index}
            view={view}
          />
        ))
      )}
    </View>
  );
}

const NOTICE_COPY: Readonly<Record<SyncConflictsNotice['kind'], NoticeCopy>> = {
  settled: { title: 'sync.conflicts.settledTitle', body: 'sync.conflicts.settledBody' },
  alreadyResolved: {
    title: 'sync.conflicts.alreadyResolvedTitle',
    body: 'sync.conflicts.alreadyResolvedBody',
  },
  stale: { title: 'sync.conflicts.staleTitle', body: 'sync.conflicts.staleBody' },
  offline: { title: 'sync.conflicts.offlineTitle', body: 'sync.conflicts.offlineBody' },
};

/** Which side the standing decision kept, said in the words the cards use. */
const STANDING_SIDE = {
  RESOLVED_LOCAL_WINS: SIDE.local,
  RESOLVED_SERVER_WINS: SIDE.server,
} as const;

/**
 * What the last action meant. `settled` confirms a completed round trip — the
 * card is gone, so the confirmation has to live here. `alreadyResolved` says
 * another device decided first and names the side that stands, so
 * first-choice-wins is visible rather than merely enforced. `stale` says the
 * account moved on and the comparison must be looked at again, and offers
 * exactly that. `offline` is truthful about both halves: the choice is stored on
 * this device now, and the round trip finishes later.
 */
function ActionNotice({ notice, onReview }: { notice: SyncConflictsNotice; onReview: () => void }) {
  const theme = useTheme();
  const { t } = useLocalization();
  const copy = NOTICE_COPY[notice.kind];

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Banner
        title={t(copy.title)}
        tone={
          notice.kind === 'settled' || notice.kind === 'alreadyResolved' ? 'success' : 'warning'
        }
      >
        {t(copy.body)}
      </Banner>
      {notice.kind === 'alreadyResolved' ? (
        <AppText variant="label" testID="sync-conflicts-standing-side">
          {t(STANDING_SIDE[notice.standing])}
        </AppText>
      ) : null}
      {notice.kind === 'stale' ? (
        <AppButton
          accessibilityLabel={t('sync.conflicts.staleAction')}
          onPress={onReview}
          testID="sync-conflicts-review-again"
          variant="secondary"
        >
          {t('sync.conflicts.staleAction')}
        </AppButton>
      ) : null}
    </View>
  );
}
