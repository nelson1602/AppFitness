import {
  formatNumber,
  type SupportedLanguage,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { Banner } from '@/shared/presentation';

import type { SyncSummary } from '../../domain/dashboard.types';

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
