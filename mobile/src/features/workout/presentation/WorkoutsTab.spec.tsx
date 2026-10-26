import { fireEvent, render, screen } from '@testing-library/react-native';

import type { HomeSummary } from '@/features/dashboard/domain/home-summary';

import { WorkoutsTab } from './WorkoutsTab';

let mockLanguage: 'en' | 'es' = 'en';
let mockStatus = 'ready';
let mockSummary: HomeSummary;
let mockRoutine: { schedule: { kind: 'TRAINING' | 'RECOVERY' }[] } | null;
const mockLoadHomeData = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => effect(), [effect]);
  },
}));
jest.mock('../application/workout.store', () => ({
  useWorkoutStore: (select: (state: { status: string }) => unknown) =>
    select({ status: mockStatus }),
}));
jest.mock('@/features/dashboard/application/use-home-data', () => ({
  loadHomeData: () => mockLoadHomeData(),
  useHomeData: () => ({ summary: mockSummary, routine: mockRoutine, weekdayIndex: 4 }),
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

const TRAINING: HomeSummary = {
  week: { done: 1, goal: 4, complete: false },
  weight: null,
  today: { kind: 'training', minutes: 40, completed: false },
  coach: 'start',
  calories: { consumed: null, target: null, share: null },
};

function push() {
  return jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router.push;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockStatus = 'ready';
  mockSummary = TRAINING;
  // Mon Tue Thu Sat training, as the generator's 4-day pattern.
  mockRoutine = {
    schedule: ['T', 'T', 'R', 'T', 'R', 'T', 'R'].map((day) => ({
      kind: day === 'T' ? 'TRAINING' : 'RECOVERY',
    })),
  };
});

describe('WorkoutsTab (ADR-P039)', () => {
  it('loads on focus and shows the iCoach week, today marked', async () => {
    mockLanguage = 'es';
    await render(<WorkoutsTab />);

    expect(mockLoadHomeData).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: 'Tu semana' })).toBeOnTheScreen();
    expect(screen.getByTestId('workouts-day-0').props.accessibilityLabel).toBe(
      'Lunes, entrenamiento',
    );
    expect(screen.getByTestId('workouts-day-4').props.accessibilityLabel).toBe('Viernes, descanso');
    expect(screen.getByTestId('workouts-today')).toHaveTextContent(
      'Sesión de cuerpo completo · 40 min',
    );
  });

  it("starts today's session from the week card", async () => {
    await render(<WorkoutsTab />);
    await fireEvent.press(screen.getByTestId('workouts-start'));
    expect(push()).toHaveBeenCalledWith('/workout-log');
  });

  it('offers no start on a rest day or without a plan', async () => {
    mockSummary = { ...TRAINING, coach: 'rest', today: { kind: 'rest', active: true } };
    await render(<WorkoutsTab />);
    expect(screen.queryByTestId('workouts-start')).toBeNull();

    mockSummary = { ...TRAINING, coach: 'no-plan', today: { kind: 'unknown' } };
    mockRoutine = null;
    await render(<WorkoutsTab />);
    expect(screen.queryByTestId('workouts-day-0')).toBeNull();
    expect(screen.getByTestId('workouts-today')).toHaveTextContent(
      'Complete your profile and goal so the iCoach can plan your week.',
    );
  });

  it.each([
    ['workouts-plan', '/routines'],
    ['workouts-log', '/workout-log'],
    ['workouts-routines', '/routines'],
    ['workouts-exercises', '/exercises'],
  ] as const)('%s opens %s', async (testID, href) => {
    await render(<WorkoutsTab />);
    await fireEvent.press(screen.getByTestId(testID));
    expect(push()).toHaveBeenCalledWith(href);
  });

  it('renders the honest Web state with no plan and no actions (ADR-P019)', async () => {
    mockStatus = 'web-unavailable';
    mockLanguage = 'es';
    await render(<WorkoutsTab />);

    expect(
      screen.getByText('La sección Entrenamientos no está disponible en la web'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('workouts-week-card')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
