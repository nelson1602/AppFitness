import { render, screen } from '@testing-library/react-native';

import { BUILT_IN_EXERCISES } from '../infrastructure/exercise-catalog.data';
import { ExerciseExclusionNote } from './ExerciseExclusionNote';

// Back squat involves deep_squat / max_effort_lifts / valsalva_heavy_lifts.
const backSquat = BUILT_IN_EXERCISES[0];

describe('ExerciseExclusionNote', () => {
  it('warns when the exercise intersects the plan’s excluded movements', async () => {
    await render(<ExerciseExclusionNote exercise={backSquat} excludedMovements={['deep_squat']} />);
    expect(screen.getByText(/May conflict.*deep_squat/)).toBeOnTheScreen();
  });

  it('renders nothing when the exercise is allowed (no intersection)', async () => {
    const { toJSON } = await render(
      <ExerciseExclusionNote exercise={backSquat} excludedMovements={['running']} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders nothing for a custom/unmapped exercise (neutral, never auto-excluded)', async () => {
    const { toJSON } = await render(
      <ExerciseExclusionNote exercise={undefined} excludedMovements={['deep_squat']} />,
    );
    expect(toJSON()).toBeNull();
  });
});
