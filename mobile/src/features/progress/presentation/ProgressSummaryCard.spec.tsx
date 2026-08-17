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

  it('renders the latest weight and weekly volume when present', async () => {
    setState({ bodyWeights: [weight], snapshots: [week] });
    await render(<ProgressSummaryCard onPress={jest.fn()} />);
    expect(screen.getByText('80 kg')).toBeOnTheScreen();
    expect(screen.getByText('as of 2026-08-03')).toBeOnTheScreen();
    expect(screen.getByText(/This week: 12000 kg volume · 3 workouts/)).toBeOnTheScreen();
  });

  it('fires onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<ProgressSummaryCard onPress={onPress} />);
    fireEvent.press(screen.getByTestId('dashboard-progress-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
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
});
