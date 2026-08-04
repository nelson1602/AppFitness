import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ProgressState } from '../application/progress.store';
import type { BodyWeight, ProgressSnapshot } from '../domain/progress';
import { ProgressSummaryCard } from './ProgressSummaryCard';

let mockState: ProgressState;

jest.mock('../application/progress.store', () => ({
  useProgressStore: () => mockState,
}));

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
});
