import { fireEvent, render, screen } from '@testing-library/react-native';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { ConflictReviewModel, LocalConflictView } from '@/shared/infrastructure/sync';

import type { SyncConflictsState } from '../application/sync-conflicts.store';
import { SyncConflictsScreen } from './SyncConflictsScreen';

/**
 * The `/sync-conflicts` surface — ADR-P030 **C-6**.
 *
 * Covers every arm this screen can enter and, more importantly, the properties
 * that make it safe to ship: **no identifier, code or payload is ever drawn**,
 * a refused presentation offers no decision, and only the resolutions C-4
 * declared available are offered.
 */

const refresh = jest.fn();
const choose = jest.fn();
const settle = jest.fn();

let mockState: SyncConflictsState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../application/sync-conflicts.store', () => ({
  useSyncConflictsStore: (selector?: (state: SyncConflictsState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));
jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual('@/shared/localization/resources/en') as {
    en: Record<string, string>;
  };
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  const actual = jest.requireActual('@/shared/localization/format') as Record<string, unknown>;
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => (mockLanguage === 'es' ? es[key] : en[key]) ?? key,
    }),
  };
});
// A screen must never reach SQLite (.ai/06_MOBILE.md). Spying on the database
// module proves this one goes through the C-4 service and nothing else.
jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));

const { en } = jest.requireActual('@/shared/localization/resources/en') as {
  en: Record<string, string>;
};

function reviewModel(overrides: Partial<ConflictReviewModel> = {}): ConflictReviewModel {
  return {
    conflictId: 'e1e5f0aa-0000-4000-8000-000000000001',
    entityKind: 'body_weights',
    comparisonDate: '2026-03-01',
    baseVersion: 3,
    currentServerVersion: 5,
    detectedAt: '2026-03-02T08:00:00.000Z',
    settlement: 'UNDECIDED',
    fields: [
      {
        field: 'weight_kg',
        kind: 'number',
        local: { state: 'value', value: 81.5 },
        server: { state: 'value', value: 80 },
        comparison: 'different',
      },
      {
        field: 'notes',
        kind: 'text',
        local: { state: 'hidden' },
        server: { state: 'absent' },
        comparison: 'unknown',
      },
      {
        field: 'goal_type',
        kind: 'enum',
        local: { state: 'value', value: 'MUSCLE_GAIN' },
        server: { state: 'value', value: 'FAT_LOSS' },
        comparison: 'different',
      },
    ],
    ...overrides,
  };
}

function conflict(overrides: Partial<LocalConflictView> = {}): LocalConflictView {
  return {
    id: 'e1e5f0aa-0000-4000-8000-000000000001',
    entityType: 'body_weights',
    entityId: 'e1e5f0aa-0000-4000-8000-0000000000e5',
    baseVersion: 3,
    serverVersion: 5,
    createdAt: '2026-03-02T08:00:00.000Z',
    chosenResolution: null,
    chosenAt: null,
    settlementStatus: null,
    settlementAttempts: 0,
    nextAttemptAt: null,
    lastFailureCode: null,
    blockedResolution: null,
    serverDeleted: false,
    notResolvableReason: null,
    availableResolutions: ['RESOLVED_LOCAL_WINS', 'RESOLVED_SERVER_WINS'],
    review: { status: 'REVIEWABLE', model: reviewModel() },
    ...overrides,
  };
}

function setStore(partial: Partial<SyncConflictsState>) {
  mockState = {
    status: 'ready',
    conflicts: [],
    error: null,
    notice: null,
    busyConflictId: null,
    refresh,
    choose,
    settle,
    ...partial,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  setStore({});
});

describe('the arms this surface can be in', () => {
  it('waits rather than claiming the account is clear', async () => {
    setStore({ status: 'loading' });
    await render(<SyncConflictsScreen />);

    expect(screen.getByTestId('sync-conflicts-loading')).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.loading'])).toBeOnTheScreen();
    expect(screen.queryByText(en['sync.conflicts.emptyTitle'])).not.toBeOnTheScreen();
  });

  it('says plainly that nothing needs a decision', async () => {
    setStore({ status: 'ready', conflicts: [] });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.emptyTitle'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.emptyBody'])).toBeOnTheScreen();
  });

  it('offers a retry after a failed read, and reassures that nothing was lost', async () => {
    setStore({ status: 'error', error: 'load' });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.errorTitle'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.errorBody'])).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('sync-conflicts-retry'));
    expect(refresh).toHaveBeenCalled();
  });

  it('words a failed write as a failed write, not as a failed read', async () => {
    setStore({ status: 'error', error: 'choose' });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.choiceErrorTitle'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.choiceErrorBody'])).toBeOnTheScreen();
    // "while opening this list" would misdescribe a choice that failed to save.
    expect(screen.queryByText(en['sync.conflicts.errorBody'])).not.toBeOnTheScreen();
  });

  it('renders one card per conflict', async () => {
    setStore({
      conflicts: [conflict(), conflict({ id: 'second', entityType: 'goals' })],
    });
    await render(<SyncConflictsScreen />);

    expect(screen.getByTestId('conflict-card-0')).toBeOnTheScreen();
    expect(screen.getByTestId('conflict-card-1')).toBeOnTheScreen();
  });
});

describe('Web is a terminal, controlless boundary', () => {
  beforeEach(async () => {
    setStore({ status: 'web-unavailable' });
    await render(<SyncConflictsScreen />);
  });

  it('states the boundary and offers no way past it', async () => {
    expect(screen.getByText(en['sync.conflicts.webUnavailableTitle'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.webUnavailableBody'])).toBeOnTheScreen();
    // No retry, no sample data, no continue-anyway (ADR-P019 §5).
    expect(screen.queryByText(en['sync.conflicts.retry'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['sync.conflicts.intro'])).not.toBeOnTheScreen();
  });

  it('exposes no resolution control at all', async () => {
    expect(screen.queryByText(en['sync.conflicts.choice.keepThisDevice'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['sync.conflicts.choice.keepAccount'])).not.toBeOnTheScreen();
    expect(screen.container.queryAll((node) => node.type === 'Pressable')).toEqual([]);
  });

  it('never touches the local database', async () => {
    expect(queryAll).not.toHaveBeenCalled();
    expect(queryFirst).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});

describe('reviewing one conflict', () => {
  beforeEach(async () => {
    setStore({ conflicts: [conflict()] });
    await render(<SyncConflictsScreen />);
  });

  it('names the record by its kind and its own date, never by an id', async () => {
    expect(screen.getByText(en['sync.conflicts.record.body_weights'])).toBeOnTheScreen();
    expect(screen.getByText(/Mar 1, 2026/)).toBeOnTheScreen();
  });

  it('states that nothing changes until the user chooses', async () => {
    expect(screen.getByText(en['sync.conflicts.intro'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.choice.noChangeYet'])).toBeOnTheScreen();
  });

  it('tells the two sides apart in text', async () => {
    expect(screen.getByText(/On this device: 81.5/)).toBeOnTheScreen();
    expect(screen.getByText(/Saved in your account: 80/)).toBeOnTheScreen();
  });

  it('labels each field and marks how the sides compare', async () => {
    expect(screen.getByText(en['sync.conflicts.field.weight_kg'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.field.goal_type'])).toBeOnTheScreen();
    // Two fields differ and one cannot be compared; each row carries its own
    // marker, so the differing ones appear twice.
    expect(screen.getAllByText(en['sync.conflicts.compare.different'])).toHaveLength(2);
    expect(screen.getByText(en['sync.conflicts.compare.unknown'])).toBeOnTheScreen();
  });

  it('reads a controlled value as words, never as its stored form', async () => {
    expect(screen.getByText(/On this device: Muscle gain/)).toBeOnTheScreen();
    expect(screen.getByText(/Saved in your account: Fat loss/)).toBeOnTheScreen();
  });

  it('says a withheld value exists without showing it, and never as empty', async () => {
    expect(screen.getByText(/Saved, not shown here/)).toBeOnTheScreen();
    expect(screen.getByText(/Not part of this change/)).toBeOnTheScreen();
  });

  it('offers both resolutions, each with its consequence and accessible name', async () => {
    expect(screen.getByText(en['sync.conflicts.choice.keepThisDevice'])).toBeOnTheScreen();
    expect(
      screen.getByText(en['sync.conflicts.choice.keepThisDeviceDescription']),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(en['sync.conflicts.choice.keepThisDeviceAccessibility']),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(en['sync.conflicts.choice.keepAccountAccessibility']),
    ).toBeOnTheScreen();
  });

  it('sends the chosen resolution to the service', async () => {
    await fireEvent.press(screen.getByTestId('conflict-choose-local-0'));
    expect(choose).toHaveBeenCalledWith(
      'e1e5f0aa-0000-4000-8000-000000000001',
      'RESOLVED_LOCAL_WINS',
    );

    await fireEvent.press(screen.getByTestId('conflict-choose-account-0'));
    expect(choose).toHaveBeenCalledWith(
      'e1e5f0aa-0000-4000-8000-000000000001',
      'RESOLVED_SERVER_WINS',
    );
  });

  it('gives every control a 44×44 target', async () => {
    for (const node of screen.container.queryAll((n) => n.type === 'Pressable')) {
      const style = node.props.style({ pressed: false }) as {
        minHeight: number;
        minWidth: number;
      }[];
      const flattened = Object.assign({}, ...style.filter(Boolean));
      expect(flattened.minHeight).toBeGreaterThanOrEqual(44);
      expect(flattened.minWidth).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('the surface never draws anything internal', () => {
  const forbidden = [
    'e1e5f0aa',
    '[REDACTED]',
    'RESOLVED_LOCAL_WINS',
    'RESOLVED_SERVER_WINS',
    'RESTORE_UNSUPPORTED',
    'REMOTE_ORIGIN',
    'body_weights',
    'weight_kg',
    'sync_conflicts',
    'local_payload',
    'user_id',
    'MUSCLE_GAIN',
    'FAT_LOSS',
    'goal_type',
  ];

  function renderedText(): string {
    return screen.container
      .queryAll((node) => typeof node.type === 'string')
      .flatMap((node) => node.children)
      .filter((child): child is string => typeof child === 'string')
      .join(' | ');
  }

  it.each([
    ['a reviewable conflict', () => conflict()],
    [
      'a conflict that cannot be decided here',
      () => conflict({ notResolvableReason: 'REMOTE_ORIGIN', availableResolutions: [] }),
    ],
    [
      'a refused presentation',
      () =>
        conflict({
          availableResolutions: [],
          review: { status: 'UNSUPPORTED', entityKind: 'body_weights', reason: 'UNKNOWN_FIELD' },
        }),
    ],
    [
      'a blocked restore',
      () =>
        conflict({
          blockedResolution: 'RESOLVED_LOCAL_WINS',
          lastFailureCode: 'RESTORE_UNSUPPORTED',
          availableResolutions: ['RESOLVED_SERVER_WINS'],
          serverDeleted: true,
          review: {
            status: 'REVIEWABLE',
            model: reviewModel({ settlement: 'BLOCKED' }),
          },
        }),
    ],
  ])('shows no identifier or internal code for %s', async (_label, build) => {
    setStore({ conflicts: [build()] });
    await render(<SyncConflictsScreen />);

    const text = renderedText();
    for (const token of forbidden) expect(text).not.toContain(token);
  });

  it('introduces no live region and no imperative announcement (ADR-P024)', async () => {
    setStore({ conflicts: [conflict()], notice: { kind: 'settled', conflictId: 'x' } });
    await render(<SyncConflictsScreen />);

    const announcing = screen.container.queryAll(
      (node) =>
        node.props?.accessibilityLiveRegion !== undefined ||
        node.props?.['aria-live'] !== undefined,
    );
    expect(announcing).toEqual([]);
  });
});

describe('conditions that withhold the decision', () => {
  it('explains a remote-origin conflict and offers no choice', async () => {
    setStore({
      conflicts: [conflict({ notResolvableReason: 'REMOTE_ORIGIN', availableResolutions: [] })],
    });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.blocked.remoteTitle'])).toBeOnTheScreen();
    expect(screen.queryByTestId('conflict-choose-local-0')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('conflict-choose-account-0')).not.toBeOnTheScreen();
  });

  it('asks the user to update the app when a column is unrecognized', async () => {
    setStore({
      conflicts: [
        conflict({
          availableResolutions: [],
          review: { status: 'UNSUPPORTED', entityKind: 'body_weights', reason: 'UNKNOWN_FIELD' },
        }),
      ],
    });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.blocked.updateAppTitle'])).toBeOnTheScreen();
    // Fail closed: no comparison is drawn from a payload the presenter refused.
    expect(screen.queryByText(en['sync.conflicts.field.weight_kg'])).not.toBeOnTheScreen();
    expect(screen.queryByTestId('conflict-choose-local-0')).not.toBeOnTheScreen();
  });

  it('says a stored choice is safe and needs nothing more', async () => {
    setStore({
      conflicts: [
        conflict({
          chosenResolution: 'RESOLVED_LOCAL_WINS',
          availableResolutions: [],
          review: {
            status: 'REVIEWABLE',
            model: reviewModel({ settlement: 'CHOICE_RECORDED' }),
          },
        }),
      ],
    });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.pendingTitle'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.status.choiceRecorded'], { exact: false }));
    expect(screen.queryByTestId('conflict-choose-local-0')).not.toBeOnTheScreen();
  });

  it('keeps a failed settlement retryable without alarming', async () => {
    setStore({
      conflicts: [
        conflict({
          chosenResolution: 'RESOLVED_LOCAL_WINS',
          settlementStatus: 'FAILED',
          availableResolutions: [],
          review: {
            status: 'REVIEWABLE',
            model: reviewModel({ settlement: 'RETRYING' }),
          },
        }),
      ],
    });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.failedTitle'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('conflict-retry-0'));
    expect(settle).toHaveBeenCalledWith('e1e5f0aa-0000-4000-8000-000000000001');
  });

  it('offers only the remaining resolution once a restore was refused', async () => {
    setStore({
      conflicts: [
        conflict({
          blockedResolution: 'RESOLVED_LOCAL_WINS',
          availableResolutions: ['RESOLVED_SERVER_WINS'],
          review: {
            status: 'REVIEWABLE',
            model: reviewModel({ settlement: 'BLOCKED' }),
          },
        }),
      ],
    });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.restoreUnsupportedTitle'])).toBeOnTheScreen();
    expect(screen.getByTestId('conflict-choose-account-0')).toBeOnTheScreen();
    expect(screen.queryByTestId('conflict-choose-local-0')).not.toBeOnTheScreen();
  });

  it('warns that keeping this device’s version restores a deleted record', async () => {
    setStore({ conflicts: [conflict({ serverDeleted: true })] });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.deletedElsewhereTitle'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.deletedElsewhereBody'])).toBeOnTheScreen();
    expect(screen.getByTestId('conflict-choose-local-0')).toBeOnTheScreen();
  });
});

describe('what the last action meant', () => {
  it('confirms a completed round trip', async () => {
    setStore({ conflicts: [], notice: { kind: 'settled', conflictId: 'x' } });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.settledTitle'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.settledBody'])).toBeOnTheScreen();
  });

  it('requires a fresh review when the account moved on, and offers it', async () => {
    setStore({ conflicts: [conflict()], notice: { kind: 'stale', conflictId: 'x' } });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.staleTitle'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sync-conflicts-review-again'));
    expect(refresh).toHaveBeenCalled();
  });

  it.each([
    ['RESOLVED_LOCAL_WINS', 'sync.conflicts.side.thisDevice'],
    ['RESOLVED_SERVER_WINS', 'sync.conflicts.side.account'],
  ] as const)(
    'says a decision was taken elsewhere and names the side (%s)',
    async (standing, side) => {
      setStore({
        conflicts: [],
        notice: { kind: 'alreadyResolved', conflictId: 'x', standing },
      });
      await render(<SyncConflictsScreen />);

      expect(screen.getByText(en['sync.conflicts.alreadyResolvedTitle'])).toBeOnTheScreen();
      expect(screen.getByText(en['sync.conflicts.alreadyResolvedBody'])).toBeOnTheScreen();
      expect(screen.getByTestId('sync-conflicts-standing-side')).toHaveTextContent(en[side]);
    },
  );

  it('names no standing resolution in its stored form', async () => {
    setStore({
      conflicts: [],
      notice: { kind: 'alreadyResolved', conflictId: 'x', standing: 'RESOLVED_SERVER_WINS' },
    });
    await render(<SyncConflictsScreen />);

    expect(screen.toJSON()).not.toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toContain('RESOLVED_SERVER_WINS');
  });

  it('is truthful about offline: stored now, finished later', async () => {
    setStore({ conflicts: [conflict()], notice: { kind: 'offline', conflictId: 'x' } });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText(en['sync.conflicts.offlineTitle'])).toBeOnTheScreen();
    expect(screen.getByText(en['sync.conflicts.offlineBody'])).toBeOnTheScreen();
  });
});

describe('the withdrawn action-needed case', () => {
  it('has no copy on this surface at all', async () => {
    setStore({ conflicts: [conflict()] });
    await render(<SyncConflictsScreen />);

    // A catalog-revision park is a queue condition, not a version conflict; the
    // Food Log owns its treatment and this surface must not imply otherwise.
    const catalogue = en as Record<string, string | undefined>;
    expect(catalogue['sync.conflicts.actionNeededTitle']).toBeUndefined();
    expect(catalogue['sync.conflicts.actionNeededBody']).toBeUndefined();
    expect(screen.queryByText(/Action needed/)).not.toBeOnTheScreen();
  });
});

describe('Spanish renders from the catalogue, with no English leaking through', () => {
  it('uses the approved Spanish wording', async () => {
    mockLanguage = 'es';
    setStore({ conflicts: [conflict()] });
    await render(<SyncConflictsScreen />);

    expect(screen.getByText('Conservar la versión de este dispositivo')).toBeOnTheScreen();
    expect(screen.queryByText(en['sync.conflicts.choice.keepThisDevice'])).not.toBeOnTheScreen();
    // Controlled values follow the language too, through their own feature's
    // shipped vocabulary rather than through this family.
    expect(screen.getByText(/En este dispositivo: Aumento de masa muscular/)).toBeOnTheScreen();
  });
});
