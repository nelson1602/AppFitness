import { render, screen } from '@testing-library/react-native';

import type { ProgressSnapshot } from '../domain/progress';
import { WeeklySnapshotSummary } from './WeeklySnapshotSummary';

function snap(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    id: 'snap-1',
    weekStart: '2026-08-03',
    avgWeightKg: 80.4,
    totalVolumeKg: 12000,
    avgCalories: 2100,
    workoutCount: 3,
    isDeloadWeek: false,
    ruleVersion: '1.1.0',
    version: 1,
    syncStatus: 'synced',
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    ...overrides,
  };
}

describe('WeeklySnapshotSummary', () => {
  it('renders the empty state when there are no snapshots', async () => {
    await render(<WeeklySnapshotSummary snapshots={[]} />);
    expect(screen.getByText('No weekly insights yet.')).toBeOnTheScreen();
  });

  it('renders the latest week metrics', async () => {
    await render(<WeeklySnapshotSummary snapshots={[snap()]} />);
    expect(screen.getByText('Week of 2026-08-03')).toBeOnTheScreen();
    expect(screen.getByText('80.4 kg')).toBeOnTheScreen();
    expect(screen.getByText('12000 kg')).toBeOnTheScreen();
    expect(screen.getByText('2100 kcal')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
  });

  it('renders nulls as an em dash', async () => {
    await render(
      <WeeklySnapshotSummary
        snapshots={[snap({ avgWeightKg: null, totalVolumeKg: null, avgCalories: null })]}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the deload flag as text (Yes) when set, No otherwise', async () => {
    const { rerender } = await render(
      <WeeklySnapshotSummary snapshots={[snap({ isDeloadWeek: true })]} />,
    );
    expect(screen.getByText('Yes')).toBeOnTheScreen();

    await rerender(<WeeklySnapshotSummary snapshots={[snap({ isDeloadWeek: false })]} />);
    expect(screen.getByText('No')).toBeOnTheScreen();
  });

  it('lists earlier weeks after the latest', async () => {
    await render(
      <WeeklySnapshotSummary
        snapshots={[
          snap({ id: 'w1', weekStart: '2026-08-03' }),
          snap({ id: 'w2', weekStart: '2026-07-27', totalVolumeKg: 9000, workoutCount: 2 }),
        ]}
      />,
    );
    expect(screen.getByText('Earlier weeks')).toBeOnTheScreen();
    expect(screen.getByText(/2026-07-27: 9000 kg volume · 2 workouts/)).toBeOnTheScreen();
  });
});
