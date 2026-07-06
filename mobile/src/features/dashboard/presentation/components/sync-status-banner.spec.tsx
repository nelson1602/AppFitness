import { render, screen } from '@testing-library/react-native';

import type { SyncSummary } from '../../domain/dashboard.types';
import { SyncStatusBanner } from './sync-status-banner';

const baseSync: SyncSummary = {
  pending: 0,
  inFlight: 0,
  failed: 0,
  conflicts: 0,
  status: 'idle',
  lastSyncedAt: null,
  message: null,
};

describe('SyncStatusBanner', () => {
  it('shows local-ready state when there is no pending work', async () => {
    await render(<SyncStatusBanner sync={baseSync} />);

    expect(screen.getByText('Local data ready')).toBeOnTheScreen();
    expect(screen.getByText('Dashboard is available offline.')).toBeOnTheScreen();
  });

  it('prioritizes active sync and offline status messages', async () => {
    await render(<SyncStatusBanner sync={{ ...baseSync, status: 'syncing' }} />);
    expect(screen.getByText('Syncing')).toBeOnTheScreen();

    await render(<SyncStatusBanner sync={{ ...baseSync, status: 'offline' }} />);
    expect(screen.getByText('Offline')).toBeOnTheScreen();
  });

  it('shows conflict and pending summaries', async () => {
    await render(<SyncStatusBanner sync={{ ...baseSync, conflicts: 2 }} />);
    expect(screen.getByText('Conflicts pending')).toBeOnTheScreen();
    expect(screen.getByText('2 item(s) need review.')).toBeOnTheScreen();

    await render(<SyncStatusBanner sync={{ ...baseSync, pending: 3, failed: 1 }} />);
    expect(screen.getByText('Local changes pending')).toBeOnTheScreen();
    expect(screen.getByText('3 pending, 1 failed retry.')).toBeOnTheScreen();
  });

  it('shows a safe generic error message', async () => {
    await render(
      <SyncStatusBanner
        sync={{ ...baseSync, status: 'error', message: 'Sync needs attention.' }}
      />,
    );

    expect(screen.getByText('Sync needs attention')).toBeOnTheScreen();
    expect(screen.getByText('Sync needs attention.')).toBeOnTheScreen();
  });
});
