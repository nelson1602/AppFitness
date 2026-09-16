import { formatNumber, useLocalization } from '@/shared/localization';
import { Banner } from '@/shared/presentation';

import type { SyncSummary } from '../../domain/dashboard.types';

interface SyncStatusBannerProps {
  sync: SyncSummary;
}

export function SyncStatusBanner({ sync }: SyncStatusBannerProps) {
  const { language, t } = useLocalization();
  if (sync.status === 'syncing')
    return (
      <Banner title={t('dashboard.sync.syncingTitle')} tone="info">
        {t('dashboard.sync.syncingMessage')}
      </Banner>
    );
  if (sync.status === 'offline')
    return (
      <Banner title={t('dashboard.sync.offlineTitle')} tone="warning">
        {t('dashboard.sync.offlineMessage')}
      </Banner>
    );
  if (sync.status === 'error')
    return (
      <Banner title={t('dashboard.sync.errorTitle')} tone="error">
        {t('dashboard.sync.errorMessage')}
      </Banner>
    );
  if (sync.conflicts > 0) {
    return (
      <Banner title={t('dashboard.sync.conflictsTitle')} tone="warning">
        {formatNumber(sync.conflicts, language)}{' '}
        {sync.conflicts === 1 ? t('dashboard.sync.conflictOne') : t('dashboard.sync.conflictMany')}
      </Banner>
    );
  }
  if (sync.pending > 0 || sync.failed > 0) {
    return (
      <Banner title={t('dashboard.sync.pendingTitle')} tone="info">
        {formatNumber(sync.pending, language)}{' '}
        {sync.pending === 1 ? t('dashboard.sync.pendingOne') : t('dashboard.sync.pendingMany')},{' '}
        {formatNumber(sync.failed, language)}{' '}
        {sync.failed === 1 ? t('dashboard.sync.failedOne') : t('dashboard.sync.failedMany')}
      </Banner>
    );
  }
  return (
    <Banner title={t('dashboard.sync.readyTitle')} tone="success">
      {t('dashboard.sync.readyMessage')}
    </Banner>
  );
}
