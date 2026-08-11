import { render, screen } from '@testing-library/react-native';

import { BUILT_IN_EXERCISES } from '../infrastructure/exercise-catalog.data';
import { ExerciseExclusionNote } from './ExerciseExclusionNote';

let mockLanguage: 'en' | 'es' = 'en';

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

// Back squat involves deep_squat / max_effort_lifts / valsalva_heavy_lifts.
const backSquat = BUILT_IN_EXERCISES[0];

describe('ExerciseExclusionNote', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('warns when the exercise intersects the plan’s excluded movements', async () => {
    await render(<ExerciseExclusionNote exercise={backSquat} excludedMovements={['deep_squat']} />);
    expect(screen.getByText(/May conflict.*deep squat/)).toBeOnTheScreen();
    expect(screen.queryByText(/deep_squat/)).not.toBeOnTheScreen();
  });

  it('localizes the warning and movement label in Spanish', async () => {
    mockLanguage = 'es';
    await render(<ExerciseExclusionNote exercise={backSquat} excludedMovements={['deep_squat']} />);

    expect(screen.getByText(/Puede entrar en conflicto.*sentadilla profunda/)).toBeOnTheScreen();
    expect(screen.queryByText(/deep_squat/)).not.toBeOnTheScreen();
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
