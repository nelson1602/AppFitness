import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ProgressState } from '../application/progress.store';
import type { BodyWeight, ProgressSnapshot } from '../domain/progress';
import { ProgressScreen } from './ProgressScreen';

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
    recomputeSnapshots: jest.fn().mockResolvedValue(true),
    addBodyWeight: jest.fn().mockResolvedValue(true),
    editBodyWeight: jest.fn(),
    removeBodyWeight: jest.fn(),
    addBodyMeasurement: jest.fn().mockResolvedValue(true),
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

describe('ProgressScreen (Slice 5a)', () => {
  it('loads progress on mount', async () => {
    await render(<ProgressScreen />);
    await waitFor(() => expect(mockState.load).toHaveBeenCalledTimes(1));
  });

  it('renders a loading state', async () => {
    setState({ status: 'loading' });
    await render(<ProgressScreen />);
    expect(screen.getByLabelText('Loading progress')).toBeOnTheScreen();
  });

  it('surfaces a load error', async () => {
    setState({ status: 'error', error: 'Your progress could not be loaded right now.' });
    await render(<ProgressScreen />);
    expect(screen.getByText('Progress unavailable')).toBeOnTheScreen();
    expect(screen.getByText('Your progress could not be loaded right now.')).toBeOnTheScreen();
  });

  it('surfaces a save error inline without wiping the forms (screen stays usable)', async () => {
    setState({
      status: 'ready',
      error: 'We could not save your changes. Please try again.',
    });
    await render(<ProgressScreen />);
    // Inline banner shown…
    expect(screen.getByText('We could not save your changes. Please try again.')).toBeOnTheScreen();
    // …but the full-screen "unavailable" state is NOT used, and the entry
    // forms remain interactive.
    expect(screen.queryByText('Progress unavailable')).not.toBeOnTheScreen();
    expect(screen.getByTestId('body-weight-submit')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-recompute')).toBeOnTheScreen();
  });

  it('renders the empty state when nothing is recorded', async () => {
    await render(<ProgressScreen />);
    expect(screen.getByText('No weight recorded yet.')).toBeOnTheScreen();
    // Weekly summary + both trends fall back to their own text-first empty states.
    expect(screen.getByText('No weekly insights yet.')).toBeOnTheScreen();
    expect(screen.getAllByText('No data yet.')).toHaveLength(2);
  });

  it('renders the latest recorded weight when present', async () => {
    setState({ bodyWeights: [weight] });
    await render(<ProgressScreen />);
    expect(screen.getByText('80 kg on 2026-08-03')).toBeOnTheScreen();
  });

  it('renders the weight/volume trends and weekly summary when data exists', async () => {
    setState({
      bodyWeights: [weight, { ...weight, id: 'bw-0', date: '2026-08-01', weightKg: 81 }],
      snapshots: [week],
    });
    await render(<ProgressScreen />);
    // Weight trend (2 points → bars with per-point a11y labels).
    expect(screen.getByLabelText('2026-08-01: 81 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('2026-08-03: 80 kg')).toBeOnTheScreen();
    // Weekly snapshot summary is rendered.
    expect(screen.getByTestId('weekly-snapshot-summary')).toBeOnTheScreen();
    expect(screen.getByText('Week of 2026-08-03')).toBeOnTheScreen();
  });

  it('dispatches recompute from the "Update weekly insights" button', async () => {
    await render(<ProgressScreen />);
    await fireEvent.press(screen.getByTestId('progress-recompute'));
    await waitFor(() => expect(mockState.recomputeSnapshots).toHaveBeenCalledTimes(1));
  });

  it('recomputes weekly insights after a successful body-weight add', async () => {
    await render(<ProgressScreen />);

    await fireEvent.changeText(screen.getByTestId('field-weightKg'), '81');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body weight' }));

    await waitFor(() => expect(mockState.addBodyWeight).toHaveBeenCalledTimes(1));
    expect(mockState.addBodyWeight).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 81 }));
    await waitFor(() => expect(mockState.recomputeSnapshots).toHaveBeenCalledTimes(1));
  });

  it('does not recompute after a body-measurement add (measurements do not feed snapshots)', async () => {
    await render(<ProgressScreen />);

    await fireEvent.changeText(screen.getByTestId('field-waistCm'), '82');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body measurements' }));

    await waitFor(() => expect(mockState.addBodyMeasurement).toHaveBeenCalledTimes(1));
    expect(mockState.recomputeSnapshots).not.toHaveBeenCalled();
  });
});
