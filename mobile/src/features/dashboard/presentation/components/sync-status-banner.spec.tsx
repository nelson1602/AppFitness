import { render, screen } from '@testing-library/react-native';

import type { SyncSummary } from '../../domain/dashboard.types';
import { SyncStatusBanner } from './sync-status-banner';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

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
  beforeEach(() => {
    mockLanguage = 'en';
  });

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
    expect(screen.getByText('2 items need review.')).toBeOnTheScreen();

    await render(<SyncStatusBanner sync={{ ...baseSync, pending: 3, failed: 1 }} />);
    expect(screen.getByText('Local changes pending')).toBeOnTheScreen();
    expect(screen.getByText('3 pending, 1 failed retry.')).toBeOnTheScreen();
  });

  it('shows a safe generic error message', async () => {
    await render(
      <SyncStatusBanner
        sync={{ ...baseSync, status: 'error', message: 'raw transport failure' }}
      />,
    );

    expect(screen.getByText('Sync needs attention')).toBeOnTheScreen();
    expect(screen.getByText('Your local changes are safe. We will try again.')).toBeOnTheScreen();
    expect(screen.queryByText('raw transport failure')).toBeNull();
  });

  it('localizes offline and counted states in Spanish', async () => {
    mockLanguage = 'es';

    await render(<SyncStatusBanner sync={{ ...baseSync, pending: 3, failed: 1 }} />);

    expect(screen.getByText('Cambios locales pendientes')).toBeOnTheScreen();
    expect(screen.getByText('3 pendientes, 1 reintento fallido.')).toBeOnTheScreen();
  });
});
