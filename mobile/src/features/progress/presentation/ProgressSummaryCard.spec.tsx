import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ProgressState } from '../application/progress.store';
import type { BodyWeight, ProgressSnapshot } from '../domain/progress';
import { ProgressSummaryCard } from './ProgressSummaryCard';

let mockState: ProgressState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../application/progress.store', () => ({
  useProgressStore: () => mockState,
}));

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

function setState(overrides: Partial<ProgressState> = {}): void {
  mockState = {
    status: 'ready',
    bodyWeights: [],
    bodyMeasurements: [],
    snapshots: [],
    error: null,
    load: jest.fn(),
    loadSnapshots: jest.fn(),
    recomputeSnapshots: jest.fn(),
    addBodyWeight: jest.fn(),
    editBodyWeight: jest.fn(),
    removeBodyWeight: jest.fn(),
    addBodyMeasurement: jest.fn(),
    editBodyMeasurement: jest.fn(),
    removeBodyMeasurement: jest.fn(),
    ...overrides,
  } as ProgressState;
}

const weight: BodyWeight = {
  id: 'bw-1',
  date: '2026-08-03',
  weightKg: 80,
  notes: null,
  version: 1,
  syncStatus: 'synced',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const week: ProgressSnapshot = {
  id: 'snap-1',
  weekStart: '2026-08-03',
  avgWeightKg: 80,
  totalVolumeKg: 12000,
  avgCalories: 2100,
  workoutCount: 3,
  isDeloadWeek: false,
  ruleVersion: '1.1.0',
  version: 1,
  syncStatus: 'synced',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  setState();
});

describe('ProgressSummaryCard', () => {
  it('loads progress on mount', async () => {
    render(<ProgressSummaryCard onPress={jest.fn()} />);
    await waitFor(() => expect(mockState.load).toHaveBeenCalledTimes(1));
  });

  it('renders the empty prompt when nothing is recorded', async () => {
    await render(<ProgressSummaryCard onPress={jest.fn()} />);
    expect(screen.getByText('No weight yet')).toBeOnTheScreen();
    expect(screen.getByText('Tap to record and track your progress.')).toBeOnTheScreen();
  });

  it('renders the latest weight and weekly volume with localized date/number when present', async () => {
    setState({ bodyWeights: [weight], snapshots: [week] });
    await render(<ProgressSummaryCard onPress={jest.fn()} />);
    expect(screen.getByText('80 kg')).toBeOnTheScreen();
    expect(screen.getByText('as of Aug 3, 2026')).toBeOnTheScreen();
    // Localized thousands separator (en): 12,000.
    expect(screen.getByText(/This week: 12,000 kg volume · 3 workouts/)).toBeOnTheScreen();
  });

  it('fires onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<ProgressSummaryCard onPress={onPress} />);
    fireEvent.press(screen.getByTestId('dashboard-progress-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the latest weight and weekly summary in Spanish (decimal comma, thousands dot, one/many)', async () => {
    mockLanguage = 'es';
    setState({
      bodyWeights: [{ ...weight, weightKg: 80.5 }],
      snapshots: [{ ...week, workoutCount: 1 }],
    });
    await render(<ProgressSummaryCard onPress={jest.fn()} />);
    expect(screen.getByText('80,5 kg')).toBeOnTheScreen();
    // Connector "al" + day 3 (local parse, no UTC shift).
    expect(screen.getByText(/^al 3\b.*2026$/)).toBeOnTheScreen();
    // Spanish thousands dot + singular "entrenamiento".
    expect(
      screen.getByText(/^Esta semana: 12\.000 kg de volumen · 1 entrenamiento$/),
    ).toBeOnTheScreen();
  });

  it('renders the Spanish empty prompt when nothing is recorded', async () => {
    mockLanguage = 'es';
    setState({});
    await render(<ProgressSummaryCard onPress={jest.fn()} />);
    expect(screen.getByText('Sin peso aún')).toBeOnTheScreen();
    expect(screen.getByText('Toca para registrar y seguir tu progreso.')).toBeOnTheScreen();
  });

  it('renders a compact web-unavailable state in English with no metrics, prompt, or tap affordance (ADR-P019)', async () => {
    const onPress = jest.fn();
    setState({ status: 'web-unavailable', bodyWeights: [weight], snapshots: [week] });
    await render(<ProgressSummaryCard onPress={onPress} />);

    expect(screen.getByText('Not available on the web')).toBeOnTheScreen();
    // No metrics, setup prompt, loading, or pressable navigation affordance.
    expect(screen.queryByText('80 kg')).toBeNull();
    expect(screen.queryByText('No weight yet')).toBeNull();
    expect(screen.queryByText('Tap to record and track your progress.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.queryByTestId('dashboard-progress-card')).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders the compact web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setState({ status: 'web-unavailable' });
    await render(<ProgressSummaryCard onPress={jest.fn()} />);

    expect(screen.getByText('No disponible en la web')).toBeOnTheScreen();
    expect(screen.queryByTestId('dashboard-progress-card')).toBeNull();
  });

  // BUG-009: the card had no `error` branch, so a failed read fell through to
  // the ready arm and reported absence as if the read had succeeded. The
  // Loading branch was also untested — both are covered here.
  it('renders the loading state and stays pressable (BUG-009)', async () => {
    setState({ status: 'loading' });
    await render(<ProgressSummaryCard onPress={jest.fn()} />);

    expect(screen.getByText('Loading…')).toBeOnTheScreen();
    expect(screen.getByTestId('dashboard-progress-card')).toBeOnTheScreen();
    // Loading must never be mistaken for Empty.
    expect(screen.queryByText('No weight yet')).toBeNull();
    expect(screen.queryByText('Tap to record and track your progress.')).toBeNull();
  });

  it('renders a failed read as Error, never as "nothing recorded" (BUG-009)', async () => {
    setState({ status: 'error', bodyWeights: [], snapshots: [] });
    await render(<ProgressSummaryCard onPress={jest.fn()} />);

    expect(screen.getByText('Progress unavailable')).toBeOnTheScreen();
    expect(screen.getByText("We couldn't load your progress right now.")).toBeOnTheScreen();
    // The whole point of the bug: empty arrays must NOT read as a true answer.
    expect(screen.queryByText('No weight yet')).toBeNull();
    expect(screen.queryByText('Tap to record and track your progress.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('keeps the card pressable in Error so the owning screen is reachable (BUG-009)', async () => {
    const onPress = jest.fn();
    setState({ status: 'error' });
    await render(<ProgressSummaryCard onPress={onPress} />);

    const card = screen.getByTestId('dashboard-progress-card');
    expect(card).toBeOnTheScreen();
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('offers no retry control on the card in Error (BUG-009)', async () => {
    setState({ status: 'error' });
    await render(<ProgressSummaryCard onPress={jest.fn()} />);

    // The deck freezes this copy as report-only: no retry affordance exists
    // anywhere in the product (`.ai/08_UI_UX.md` — zero retry keys).
    expect(screen.queryByText(/Retry|Try again/i)).toBeNull();
  });

  it('renders the Error state in Spanish (BUG-009)', async () => {
    mockLanguage = 'es';
    setState({ status: 'error' });
    await render(<ProgressSummaryCard onPress={jest.fn()} />);

    expect(screen.getByText('Progreso no disponible')).toBeOnTheScreen();
    expect(screen.getByText('No pudimos cargar tu progreso en este momento.')).toBeOnTheScreen();
    expect(screen.queryByText('Sin peso aún')).toBeNull();
  });

  it('still reaches Empty after a successful read (BUG-009 regression guard)', async () => {
    setState({ status: 'ready', bodyWeights: [], snapshots: [] });
    await render(<ProgressSummaryCard onPress={jest.fn()} />);

    expect(screen.getByText('No weight yet')).toBeOnTheScreen();
    expect(screen.getByText('Tap to record and track your progress.')).toBeOnTheScreen();
    expect(screen.queryByText('Progress unavailable')).toBeNull();
  });
});
