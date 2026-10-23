import { fireEvent, render, screen } from '@testing-library/react-native';

import { WorkoutsTab } from './WorkoutsTab';

let mockLanguage: 'en' | 'es' = 'en';
let mockStatus = 'ready';
const mockLoad = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const { useEffect: useMockEffect } = jest.requireActual<typeof import('react')>('react');
    useMockEffect(() => effect(), [effect]);
  },
}));
jest.mock('../application/workout.store', () => ({
  useWorkoutStore: (select: (state: { status: string; load: () => void }) => unknown) =>
    select({ status: mockStatus, load: mockLoad }),
}));
jest.mock('./GeneratedWorkoutPlan', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return { GeneratedWorkoutPlan: () => <RN.Text testID="generated-plan">plan</RN.Text> };
});
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

function push() {
  return jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router.push;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockStatus = 'ready';
});

describe('WorkoutsTab', () => {
  it('loads on focus and shows the iCoach week first', async () => {
    await render(<WorkoutsTab />);

    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('generated-plan')).toBeOnTheScreen();
  });

  it.each([
    ['Log a workout', '/workout-log'],
    ['Manage workout routines', '/routines'],
    ['Manage your exercise library', '/exercises'],
  ] as const)('"%s" opens %s', async (name, href) => {
    await render(<WorkoutsTab />);
    await fireEvent.press(screen.getByRole('button', { name }));
    expect(push()).toHaveBeenCalledWith(href);
  });

  it('renders the honest Web state with no plan and no actions (ADR-P019)', async () => {
    mockStatus = 'web-unavailable';
    mockLanguage = 'es';
    await render(<WorkoutsTab />);

    expect(screen.getByText('Entrenamientos no está disponible en la web')).toBeOnTheScreen();
    expect(screen.queryByTestId('generated-plan')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
