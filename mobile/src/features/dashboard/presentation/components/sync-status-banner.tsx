import {
  formatNumber,
  type SupportedLanguage,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { Banner } from '@/shared/presentation';

import type { SyncProblem, SyncSummary } from '../../domain/dashboard.types';

/** v8.1: the reason a run ended without pushing, in words. */
const PROBLEM_COPY: Record<
  SyncProblem,
  (t: (key: TranslationKey) => string) => { title: string; body: string }
> = {
  session: (t) => ({
    title: t('dashboard.sync.problem.sessionTitle'),
    body: t('dashboard.sync.problem.sessionBody'),
  }),
  // v10: the same words as every other 402 (SubscriptionRequiredNotice).
  subscription: (t) => ({
    title: t('subscription.requiredTitle'),
    body: t('subscription.requiredKeptBody'),
  }),
  server: (t) => ({
    title: t('dashboard.sync.problem.serverTitle'),
    body: t('dashboard.sync.problem.serverBody'),
  }),
  unexpected: (t) => ({
    title: t('dashboard.sync.problem.unexpectedTitle'),
    body: t('dashboard.sync.problem.unexpectedBody'),
  }),
};

interface SyncStatusBannerProps {
  sync: SyncSummary;
}

type SyncTone = 'info' | 'warning' | 'error' | 'success';

/**
 * The sync state in words: a title, a one-line body and a tone. Shared by
 * the banner and Perfil's compact sync row (ADR-P039), so both always agree.
 */
export function syncStatusCopy(
  sync: SyncSummary,
  t: (key: TranslationKey) => string,
  language: SupportedLanguage,
): { title: string; body: string; tone: SyncTone } {
  const n = (value: number) => formatNumber(value, language);
  if (sync.status === 'syncing')
    return {
      title: t('dashboard.sync.syncingTitle'),
      body: t('dashboard.sync.syncingMessage'),
      tone: 'info',
    };
  if (sync.status === 'offline')
    return {
      title: t('dashboard.sync.offlineTitle'),
      body: t('dashboard.sync.offlineMessage'),
      tone: 'warning',
    };
  if (sync.status === 'error' && sync.problem)
    return { ...PROBLEM_COPY[sync.problem](t), tone: 'error' };
  if (sync.status === 'error')
    return {
      title: t('dashboard.sync.errorTitle'),
      body: t('dashboard.sync.errorMessage'),
      tone: 'error',
    };
  if (sync.conflicts > 0)
    return {
      title: t('dashboard.sync.conflictsTitle'),
      body: `${n(sync.conflicts)} ${
        sync.conflicts === 1 ? t('dashboard.sync.conflictOne') : t('dashboard.sync.conflictMany')
      }`,
      tone: 'warning',
    };
  if (sync.pending > 0 || sync.failed > 0)
    return {
      title: t('dashboard.sync.pendingTitle'),
      body: `${n(sync.pending)} ${
        sync.pending === 1 ? t('dashboard.sync.pendingOne') : t('dashboard.sync.pendingMany')
      }, ${n(sync.failed)} ${
        sync.failed === 1 ? t('dashboard.sync.failedOne') : t('dashboard.sync.failedMany')
      }`,
      tone: 'info',
    };
  return {
    title: t('dashboard.sync.readyTitle'),
    body: t('dashboard.sync.readyMessage'),
    tone: 'success',
  };
}

export function SyncStatusBanner({ sync }: SyncStatusBannerProps) {
  const { language, t } = useLocalization();
  const copy = syncStatusCopy(sync, t, language);
  return (
    <Banner title={copy.title} tone={copy.tone}>
      {copy.body}
    </Banner>
  );
}
