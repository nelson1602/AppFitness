import { render, screen } from '@testing-library/react-native';

import type { TrainingPlan } from '@/features/icoach/domain/types';

import { TrainingPlanCard } from './TrainingPlanCard';

const plan = (o: Partial<TrainingPlan> = {}): TrainingPlan => ({
  blocked: false,
  requiresMedicalClearance: false,
  intensity: 'MODERATE',
  rpeCap: 8,
  daysPerWeek: 4,
  excludedMovements: [],
  ...o,
});

describe('TrainingPlanCard', () => {
  it('renders nothing when no plan is available (safe fallback)', async () => {
    const { toJSON } = await render(<TrainingPlanCard plan={null} />);
    expect(toJSON()).toBeNull();
  });

  it('shows a blocked notice (medical priority) even if clearance is also set', async () => {
    await render(
      <TrainingPlanCard plan={plan({ blocked: true, requiresMedicalClearance: true })} />,
    );
    expect(screen.getByText('Training is on hold')).toBeOnTheScreen();
    expect(screen.queryByText('Medical clearance recommended')).toBeNull();
  });

  it('shows a clearance notice when clearance is required but not blocked', async () => {
    await render(<TrainingPlanCard plan={plan({ requiresMedicalClearance: true })} />);
    expect(screen.getByText('Medical clearance recommended')).toBeOnTheScreen();
  });

  it('surfaces intensity, RPE cap and days per week for a ready plan', async () => {
    await render(
      <TrainingPlanCard plan={plan({ intensity: 'HIGH', rpeCap: 9, daysPerWeek: 5 })} />,
    );
    expect(screen.getByText('Your training guidance')).toBeOnTheScreen();
    expect(screen.getByText('Suggested intensity: High')).toBeOnTheScreen();
    expect(screen.getByText('RPE cap: 9')).toBeOnTheScreen();
    expect(screen.getByText('Suggested training days per week: 5')).toBeOnTheScreen();
  });

  it('lists excluded movements as non-blocking guidance on a ready plan', async () => {
    await render(
      <TrainingPlanCard plan={plan({ excludedMovements: ['deep_squat', 'overhead_press'] })} />,
    );
    expect(screen.getByText('Movements to avoid: deep_squat, overhead_press')).toBeOnTheScreen();
  });
});
