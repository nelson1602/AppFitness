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
// ADR-P040 Addendum v10-A: the real-time week is its own pure rule and hook.
let mockRealtime: Record<string, unknown> = {};
jest.mock('@/features/weekly-plan/application/use-realtime-week', () => ({
  useRealtimeWeek: () => mockRealtime,
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
  mockRealtime = {
    extras: [],
    calorieBonus: 0,
    moves: [],
    lightenings: [],
    today: '2026-11-04',
  };
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

  // v10 Block A item 5: an extra workout shows for its day as "Actividad extra";
  // ADR-P040 Addendum v10-A R4: the lightened session reaches the week shown.
  it('shows extra activities and passes the lightened routine to the week', async () => {
    const routine = {
      sessions: [{ key: 's2', exercises: [{ exerciseKey: 'exercise.back_squat', sets: 3 }] }],
    };
    mockSelection = { kind: 'ready', selection: { status: 'ready', routine } };
    mockRealtime = {
      ...mockRealtime,
      extras: [
        {
          id: 'run',
          name: 'Correr 15 min',
          date: '2026-11-04',
          status: 'done',
          kind: 'cardio',
          minutes: 15,
          kcal: 123,
        },
      ],
      calorieBonus: 123,
      lightenings: [
        {
          date: '2026-11-05',
          sessionKey: 's2',
          exerciseKeys: ['exercise.back_squat'],
          groups: ['quadriceps'],
          activityId: 'lift',
          at: '',
        },
      ],
    };
    await render(<WorkoutsTab />);

    expect(screen.getByText('Extra activity')).toBeOnTheScreen();
    expect(screen.getByText('Correr 15 min')).toBeOnTheScreen();
    expect(screen.getByText('+123 kcal from activity')).toBeOnTheScreen();
    const props = mockWeekProps.mock.calls[0][0] as {
      routine: { sessions: { exercises: { sets: number }[] }[] };
    };
    expect(props.routine.sessions[0].exercises[0].sets).toBe(2);
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
