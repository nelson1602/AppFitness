import { render, screen } from '@testing-library/react-native';

import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import type { SyncSummary } from '../../domain/dashboard.types';
import { shouldShowSyncDetails, SyncDetails, unsyncedReasonKey } from './sync-details';
import { syncStatusCopy } from './sync-status-banner';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('@/shared/localization', () => {
  const actual =
    jest.requireActual<typeof import('@/shared/localization')>('@/shared/localization');
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => {
        const catalogue = jest.requireActual<Record<string, Record<string, string>>>(
          mockLanguage === 'es'
            ? '@/shared/localization/resources/es'
            : '@/shared/localization/resources/en',
        );
        return (mockLanguage === 'es' ? catalogue.es : catalogue.en)[key];
      },
    }),
  };
});

function summary(overrides: Partial<SyncSummary> = {}): SyncSummary {
  return {
    pending: 0,
    inFlight: 0,
    failed: 0,
    conflicts: 0,
    status: 'idle',
    lastSyncedAt: null,
    message: null,
    unsynced: [],
    ...overrides,
  };
}

const t = (key: keyof typeof en) => en[key];

describe('sync reason and details (v8.1)', () => {
  it('names the reason instead of a generic "needs attention"', () => {
    expect(syncStatusCopy(summary({ status: 'error', problem: 'session' }), t, 'en').title).toBe(
      en['dashboard.sync.problem.sessionTitle'],
    );
    expect(
      syncStatusCopy(summary({ status: 'error', problem: 'subscription' }), t, 'en').title,
    ).toBe(en['subscription.requiredTitle']);
    expect(syncStatusCopy(summary({ status: 'error', problem: 'unexpected' }), t, 'en').title).toBe(
      en['dashboard.sync.problem.unexpectedTitle'],
    );
    expect(syncStatusCopy(summary({ status: 'error' }), t, 'en').title).toBe(
      en['dashboard.sync.errorTitle'],
    );
  });

  it('maps the worker codes to a reason, never showing them raw', () => {
    const change = { entityType: 'goals', operation: 'CREATE', retryCount: 1 };
    expect(unsyncedReasonKey({ ...change, status: 'PENDING', lastError: null })).toBe(
      'dashboard.sync.details.waiting',
    );
    expect(
      unsyncedReasonKey({ ...change, status: 'FAILED', lastError: 'payload_unreadable: x' }),
    ).toBe('dashboard.sync.details.unreadable');
    expect(unsyncedReasonKey({ ...change, status: 'FAILED', lastError: 'http_401' })).toBe(
      'dashboard.sync.details.session',
    );
    expect(unsyncedReasonKey({ ...change, status: 'FAILED', lastError: 'http_500' })).toBe(
      'dashboard.sync.details.server',
    );
    // v10: one change still too large on its own after halving stays queued.
    expect(unsyncedReasonKey({ ...change, status: 'FAILED', lastError: 'http_413' })).toBe(
      'dashboard.sync.details.tooLarge',
    );
    expect(
      unsyncedReasonKey({ ...change, status: 'FAILED', lastError: 'Network request failed' }),
    ).toBe('dashboard.sync.details.network');
  });

  it('BUG-053: a change the server answered DEPENDENCY_NOT_READY is never "no connection"', () => {
    // The worker stores the server's retryable code as `last_error`; v11–v13
    // fell through to the connection reason while the phone was online.
    const set = {
      entityType: 'workout_sets',
      operation: 'CREATE',
      status: 'FAILED',
      retryCount: 10,
      lastError: 'DEPENDENCY_NOT_READY',
    };
    expect(unsyncedReasonKey(set)).toBe('dashboard.sync.details.dependency');
    expect(unsyncedReasonKey(set)).not.toBe('dashboard.sync.details.network');
  });

  it.each(['en', 'es'] as const)('names the dependency reason on the row (%s)', async (lang) => {
    mockLanguage = lang;
    const copy = lang === 'es' ? es : en;
    await render(
      <SyncDetails
        sync={summary({
          failed: 1,
          unsynced: [
            {
              entityType: 'workout_sets',
              operation: 'CREATE',
              status: 'FAILED',
              retryCount: 10,
              lastError: 'DEPENDENCY_NOT_READY',
            },
          ],
        })}
      />,
    );
    const row = screen.getByTestId('sync-details-row-0');
    expect(row).toHaveTextContent(copy['dashboard.sync.details.dependency'], { exact: false });
    expect(row).not.toHaveTextContent(copy['dashboard.sync.details.network'], { exact: false });
  });

  it('shows the details only after a failed run or a failed row', () => {
    const unsynced = [
      {
        entityType: 'goals',
        operation: 'CREATE',
        status: 'PENDING',
        retryCount: 0,
        lastError: null,
      },
    ];
    expect(shouldShowSyncDetails(summary({ pending: 1, unsynced }))).toBe(false);
    expect(shouldShowSyncDetails(summary({ pending: 1, status: 'error', unsynced }))).toBe(true);
    expect(shouldShowSyncDetails(summary({ failed: 1, unsynced }))).toBe(true);
    expect(shouldShowSyncDetails(summary({ status: 'error' }))).toBe(false);
  });

  it.each(['en', 'es'] as const)(
    'lists each stuck change by name and reason (%s)',
    async (lang) => {
      mockLanguage = lang;
      const copy = lang === 'es' ? es : en;
      await render(
        <SyncDetails
          sync={summary({
            status: 'error',
            failed: 1,
            pending: 1,
            unsynced: [
              {
                entityType: 'weekly_plans',
                operation: 'CREATE',
                status: 'FAILED',
                retryCount: 2,
                lastError: 'http_500',
              },
              {
                entityType: 'user_profiles',
                operation: 'CREATE',
                status: 'PENDING',
                retryCount: 0,
                lastError: null,
              },
            ],
          })}
        />,
      );

      expect(screen.getByText(copy['dashboard.sync.details.title'])).toBeTruthy();
      expect(screen.getByText(copy['sync.conflicts.record.weekly_plans'])).toBeTruthy();
      expect(screen.getByText(copy['sync.conflicts.record.user_profiles'])).toBeTruthy();
      expect(screen.getByTestId('sync-details-row-0')).toHaveTextContent(
        copy['dashboard.sync.details.server'],
        { exact: false },
      );
      expect(screen.getByTestId('sync-details-row-1')).toHaveTextContent(
        copy['dashboard.sync.details.waiting'],
        { exact: false },
      );
    },
  );
});
