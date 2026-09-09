import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { useLocalization, type TranslationKey } from '@/shared/localization';
import { AppButton, AppText, Banner } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import {
  useWellnessSafetyProfileStore,
  type WellnessSafetyProfileOutcome,
} from '../application/wellness-safety-profile.store';
import type { WellnessSafetyProfileSyncState } from '../application/wellness-safety-profile.sync-state';
import { deviceToday } from '../domain/wellness-safety-profile.rules';
import { WellnessSafetyProfileForm } from './WellnessSafetyProfileForm';

/**
 * Wellness Safety Profile screen (ADR-P017 **W-3**).
 *
 * Owns the state treatments; the form owns the fields. Both are
 * presentation-only: every read and write goes through the store to the shipped
 * W-2 boundary, and nothing here imports the repository or the database.
 *
 * ── Canonical states this surface can enter ─────────────────────────────────
 * `.ai/08_UI_UX.md` §Canonical State Patterns, per-surface bindings recorded in
 * `.ai/18_SCREEN_STATE_MATRICES.md`:
 *
 * - **Loading** — the read is in flight; no form, so a blank form is never
 *   mistaken for "nothing declared".
 * - **Empty** — the read succeeded and no profile exists: the same form,
 *   prefilled blank, with a line saying nothing is declared yet.
 * - **Error** — a load failure (with the retry this surface deliberately
 *   offers), a save failure, a removal failure, and the decoder refusal below.
 *   Never the store's raw text: the store carries a discriminant and this file
 *   supplies localized copy (distinction 8).
 * - **Pending sync** — a queued local write; `info` / muted and reassuring,
 *   because the write **is** stored on the device (distinction 4). It claims
 *   nothing about other devices, and nothing about surviving the loss of this
 *   one.
 * - **Conflict** — `warning`, never `error`, and **report-only**: no resolution
 *   path exists anywhere in v1 (BUG-012), so nothing here offers or implies
 *   one, and the copy promises no review destination.
 * - **Web unavailable** — the local database is dormant on Web (ADR-P019):
 *   `info`, no retry control, and **no unsaveable form**.
 *
 * ── Removal is from the active profile, not erasure ────────────────────────
 * W-2 removal is a **soft delete**: it sets `deleted_at` / `deleted_by`, bumps
 * the version and queues the tombstone — it does **not** blank the stored
 * field values, and the tombstone keeps synchronizing. So the copy says the
 * details leave the **active profile** and that a removal record stays on the
 * device, and it points at account deletion as the whole-account erasure path
 * (ADR-P011, `.ai/17_PRODUCT_FLOWS.md` §Cross-cutting rule 1). It promises no
 * retention period and no immediate erasure from every device or the server.
 *
 * **Data-gap and Offline are not applicable.** These answers are user-entered,
 * so nothing is a prerequisite the screen could route the user elsewhere for;
 * and no authoritative connectivity signal is exposed to this store, exactly as
 * for every other local-first feature screen at this commit.
 *
 * ── A refused stored row is replaced, never repaired ────────────────────────
 * W-2 decodes stored rows strictly and throws instead of returning a degraded
 * profile. That surfaces here as safe localized copy with **no reason, field or
 * token value**, and the stored row is left untouched — the recovery the copy
 * offers is re-entering the answers, which is an ordinary save. The form
 * therefore stays available in that state, while a *load failure* hides it: if
 * the read did not complete we do not know what is stored, and offering an edit
 * would invite an uninformed overwrite.
 */

/**
 * Write confirmations, **exhaustive over the sync state**.
 *
 * A `Record` keyed by both unions, so a new outcome or a new sync state
 * fails `tsc` instead of silently falling into a default arm. That
 * exhaustiveness is the point: treating "not pending" as "synchronized" let a
 * **conflict** render "up to date" next to the conflict warning — a
 * contradiction the user cannot resolve, and a claim the repository does not
 * support.
 *
 * - `synced` — the write reached the server, so success wording is honest.
 * - `pending` — `info`: stored on this device and awaiting synchronization.
 *   Reassuring, but it promises nothing about other devices, and nothing
 *   about surviving the loss of this one.
 * - `conflict` — `warning`: it acknowledges the **local** action only and says
 *   the existing difference remains. It never says complete, current
 *   everywhere, up to date or resolved, because none of those is true while a
 *   divergence is parked. The separate report-only Conflict banner still
 *   renders beneath it (BUG-012); this adds no resolution behaviour.
 *
 * None of the six is a ninth state — they are write confirmations, exactly
 * like the dashboard `Ready` banner.
 */
const OUTCOME_COPY: Record<
  WellnessSafetyProfileOutcome,
  Record<
    WellnessSafetyProfileSyncState,
    { title: TranslationKey; body: TranslationKey; tone: 'success' | 'info' | 'warning' }
  >
> = {
  saved: {
    synced: {
      title: 'wellness.safety.savedTitle',
      body: 'wellness.safety.savedBody',
      tone: 'success',
    },
    pending: {
      title: 'wellness.safety.savedPendingTitle',
      body: 'wellness.safety.savedPendingBody',
      tone: 'info',
    },
    conflict: {
      title: 'wellness.safety.savedConflictTitle',
      body: 'wellness.safety.savedConflictBody',
      tone: 'warning',
    },
  },
  removed: {
    synced: {
      title: 'wellness.safety.removedTitle',
      body: 'wellness.safety.removedBody',
      tone: 'success',
    },
    pending: {
      title: 'wellness.safety.removedPendingTitle',
      body: 'wellness.safety.removedPendingBody',
      tone: 'info',
    },
    conflict: {
      title: 'wellness.safety.removedConflictTitle',
      body: 'wellness.safety.removedConflictBody',
      tone: 'warning',
    },
  },
};

export function WellnessSafetyProfileScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status, profile, sync, error, outcome, load, save, remove } =
    useWellnessSafetyProfileStore();

  // The device-local calendar date, resolved once per mount and shared by the
  // form's future-date rule and the service's, so the two cannot disagree.
  const today = useMemo(() => deviceToday(), []);

  useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="headline">{t('wellness.safety.title')}</AppText>
      <AppText tone="muted">{t('wellness.safety.subtitle')}</AppText>
    </View>
  );

  // Local database is dormant on Web (ADR-P019): an honest informational state
  // with no form, no retry and no fabricated answers.
  if (status === 'web-unavailable') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        {header}
        <Banner title={t('wellness.safety.webUnavailableTitle')} tone="info">
          {t('wellness.safety.webUnavailableBody')}
        </Banner>
      </View>
    );
  }

  const loading = status === 'loading' || status === 'idle';
  const loadFailed = status === 'error' && error === 'load';
  const showForm = !loading && !loadFailed;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {header}

      {/* Positioning, stated before anything is asked (ADR-P017 Decision 1). */}
      <Banner title={t('wellness.safety.disclaimerTitle')} tone="info">
        {t('wellness.safety.disclaimerBody')}
      </Banner>
      <AppText variant="caption" tone="muted" testID="wellness-privacy-note">
        {t('wellness.safety.privacyNote')}
      </AppText>

      {loadFailed ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Banner title={t('wellness.safety.errorTitle')} tone="error">
            {t('wellness.safety.errorMessage')}
          </Banner>
          <AppButton
            accessibilityLabel={t('wellness.safety.retryAccessibility')}
            testID="wellness-retry"
            variant="secondary"
            onPress={() => {
              void load();
            }}
          >
            {t('wellness.safety.retry')}
          </AppButton>
        </View>
      ) : null}

      {/* A stored row the decoder refused. No reason, field or value is shown. */}
      {status === 'error' && error === 'invalid' ? (
        <Banner title={t('wellness.safety.invalidTitle')} tone="error">
          {t('wellness.safety.invalidMessage')}
        </Banner>
      ) : null}

      {error === 'save' ? (
        <Banner title={t('wellness.safety.saveErrorTitle')} tone="error">
          {t('wellness.safety.saveErrorMessage')}
        </Banner>
      ) : null}

      {error === 'invalidInput' ? (
        <Banner title={t('wellness.safety.invalidInputTitle')} tone="error">
          {t('wellness.safety.invalidInputMessage')}
        </Banner>
      ) : null}

      {error === 'remove' ? (
        <Banner title={t('wellness.safety.removeErrorTitle')} tone="error">
          {t('wellness.safety.removeErrorMessage')}
        </Banner>
      ) : null}

      {/* One confirmation, chosen by outcome AND sync state — see
          OUTCOME_COPY. A fresh local write is normally queued, so the
          `pending` wording is the usual arm. */}
      {outcome ? (
        <View testID={`wellness-${outcome}`}>
          <Banner
            title={t(OUTCOME_COPY[outcome][sync].title)}
            tone={OUTCOME_COPY[outcome][sync].tone}
          >
            {t(OUTCOME_COPY[outcome][sync].body)}
          </Banner>
        </View>
      ) : null}

      {/* Divergence is reported, never resolved (BUG-012), and never `error`. */}
      {sync === 'conflict' ? (
        <View testID="wellness-conflict">
          <Banner title={t('wellness.safety.syncConflictTitle')} tone="warning">
            {t('wellness.safety.syncConflictBody')}
          </Banner>
        </View>
      ) : null}

      {sync === 'pending' && !outcome ? (
        <AppText
          variant="caption"
          tone="muted"
          testID="wellness-sync-pending"
          accessibilityLabel={t('wellness.safety.syncPendingAccessibility')}
        >
          {t('wellness.safety.syncPending')}
        </AppText>
      ) : null}

      {loading ? (
        <AppText
          testID="wellness-loading"
          accessibilityLabel={t('wellness.safety.loadingAccessibility')}
        >
          {t('wellness.safety.loading')}
        </AppText>
      ) : null}

      {showForm && !profile ? (
        <AppText tone="muted" testID="wellness-empty">
          {t('wellness.safety.empty')}
        </AppText>
      ) : null}

      {showForm ? (
        <WellnessSafetyProfileForm
          profile={profile}
          saving={status === 'saving'}
          today={today}
          onSubmit={(input) => save(input, today)}
          onRemove={remove}
        />
      ) : null}
    </View>
  );
}
