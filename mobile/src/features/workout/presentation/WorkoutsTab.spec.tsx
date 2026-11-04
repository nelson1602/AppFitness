import { fireEvent, render, screen } from '@testing-library/react-native';

import { WorkoutsTab } from './WorkoutsTab';

let mockLanguage: 'en' | 'es' = 'en';
let mockStatus = 'ready';
let mockSelection: { kind: string; selection?: { status: string; routine?: unknown } } = {
  kind: 'loading',
};
const mockLoadHomeData = jest.fn();
const mockWeekProps = jest.fn();

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
jest.mock('../application/use-workout-selection', () => ({
  useWorkoutSelection: () => mockSelection,
}));
jest.mock('@/features/dashboard/application/use-home-data', () => ({
  loadHomeData: () => mockLoadHomeData(),
  useHomeData: () => ({ weekdayIndex: 2 }),
}));
jest.mock('@/features/weekly-plan/application/weekly-plan.store', () => ({
  useWeeklyPlanStore: (
    select: (state: {
      current: { weekStart: string; notes: never[] };
      revisions: never[];
      adherence: { sessions: { date: string; done: boolean }[] };
    }) => unknown,
  ) =>
    select({
      current: { weekStart: '2026-11-02', notes: [] },
      revisions: [],
      adherence: {
        sessions: [
          { date: '2026-11-02', done: true },
          { date: '2026-11-04', done: false },
        ],
      },
    }),
}));
jest.mock('@/features/weekly-plan/presentation/PlanChangePrompt', () => ({
  PlanChangePrompt: () => null,
}));
jest.mock('@/features/subscriptions/presentation/SubscriptionAccessNotice', () => ({
  SubscriptionAccessNotice: () => null,
}));
jest.mock('./WorkoutWeek', () => ({
  WorkoutWeek: (props: unknown) => {
    mockWeekProps(props);
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    return <RN.Text>workout-week</RN.Text>;
  },
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

function push() {
  return jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router.push;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockStatus = 'ready';
  mockSelection = { kind: 'loading' };
});

describe('WorkoutsTab (v8.1, prototype layout)', () => {
  it('loads on focus and shows the week with the saved plan and its done days', async () => {
    mockSelection = { kind: 'ready', selection: { status: 'ready', routine: { id: 'r' } } };
    await render(<WorkoutsTab />);

    expect(mockLoadHomeData).toHaveBeenCalled();
    expect(screen.getByText('workout-week')).toBeOnTheScreen();
    const props = mockWeekProps.mock.calls[0][0] as {
      todayIndex: number;
      weekDates: string[];
      doneDates: Set<string>;
    };
    expect(props.todayIndex).toBe(2);
    expect(props.weekDates[0]).toBe('2026-11-02');
    expect(props.weekDates).toHaveLength(7);
    expect([...props.doneDates]).toEqual(['2026-11-02']);
  });

  it('shows the loading state, then no week without a routine', async () => {
    await render(<WorkoutsTab />);
    expect(screen.getByText('Building your workout plan…')).toBeOnTheScreen();

    mockSelection = { kind: 'ready', selection: { status: 'gap' } };
    await render(<WorkoutsTab />);
    expect(screen.queryByText('workout-week')).toBeNull();
  });

  it('keeps the log, routines and library one tap away', async () => {
    await render(<WorkoutsTab />);

    await fireEvent.press(screen.getByTestId('workouts-log'));
    expect(push()).toHaveBeenCalledWith('/workout-log');
    await fireEvent.press(screen.getByTestId('workouts-routines'));
    expect(push()).toHaveBeenCalledWith('/routines');
    await fireEvent.press(screen.getByTestId('workouts-exercises'));
    expect(push()).toHaveBeenCalledWith('/exercises');
  });

  it('renders the honest Web state with no plan and no actions (ADR-P019)', async () => {
    mockStatus = 'web-unavailable';
    mockLanguage = 'es';
    await render(<WorkoutsTab />);

    expect(
      screen.getByText('La sección Entrenamientos no está disponible en la web'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('workout-week')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
