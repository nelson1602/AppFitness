import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ProgressState } from '../application/progress.store';
import type { BodyWeight } from '../domain/progress';
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

  it('renders the empty state when nothing is recorded', async () => {
    await render(<ProgressScreen />);
    expect(screen.getByText('No weight recorded yet.')).toBeOnTheScreen();
    expect(
      screen.getByText('No weekly insights yet. Add some data, then update your insights.'),
    ).toBeOnTheScreen();
  });

  it('renders the latest recorded weight when present', async () => {
    setState({ bodyWeights: [weight] });
    await render(<ProgressScreen />);
    expect(screen.getByText('80 kg on 2026-08-03')).toBeOnTheScreen();
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
