import { Banner } from '@/shared/presentation';

import type { SyncSummary } from '../../domain/dashboard.types';

interface SyncStatusBannerProps {
  sync: SyncSummary;
}

export function SyncStatusBanner({ sync }: SyncStatusBannerProps) {
  if (sync.status === 'syncing') return <Banner title="Syncing" tone="info">Sending local changes.</Banner>;
  if (sync.status === 'offline') return <Banner title="Offline" tone="warning">Showing local data.</Banner>;
  if (sync.status === 'error') return <Banner title="Sync needs attention" tone="error">{sync.message}</Banner>;
  if (sync.conflicts > 0) {
    return <Banner title="Conflicts pending" tone="warning">{sync.conflicts} item(s) need review.</Banner>;
  }
  if (sync.pending > 0 || sync.failed > 0) {
    return (
      <Banner title="Local changes pending" tone="info">
        {sync.pending} pending, {sync.failed} failed retry.
      </Banner>
    );
  }
  return <Banner title="Local data ready" tone="success">Dashboard is available offline.</Banner>;
}

