import { fireEvent, render, screen } from '@testing-library/react-native';

import { lightColors } from '@/shared/theme';

import type { HomeSummary } from '../../domain/home-summary';
import { CoachCard, ComingSoonCard, GoalCard, QuickActions, TodayTiles } from './home-cards';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
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

const EMPTY: HomeSummary = {
  week: { done: 0, goal: null, complete: false },
  weight: null,
  today: { kind: 'unknown' },
  coach: 'no-plan',
  calories: { consumed: null, target: null, share: null },
};

const TRAINING: HomeSummary = {
  week: { done: 2, goal: 4, complete: false },
  weight: { current: 80, start: 84, target: 76, progress: 0.5 },
  today: { kind: 'training', minutes: 45, completed: false },
  coach: 'start',
  calories: { consumed: 1250, target: 2500, share: 0.5 },
};

/** react-native-svg hands a stroke over as an ARGB payload; encode a token the same way. */
function svgColor(hex: string) {
  return { payload: (0xff000000 + parseInt(hex.slice(1), 16)) >>> 0, type: 0 };
}

function router() {
  return jest.requireMock<{ router: { push: jest.Mock; navigate: jest.Mock } }>('expo-router')
    .router;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
});

describe('GoalCard', () => {
  it('names the week in words and keeps the ring energy while the week is open', async () => {
    await render(<GoalCard summary={TRAINING} />);

    expect(screen.getByRole('header', { name: 'Your goal awaits' })).toBeOnTheScreen();
    expect(screen.getByLabelText('2 of 4 workouts this week')).toBeOnTheScreen();
    expect(screen.getByTestId('home-goal-status')).toHaveTextContent('2 workouts to go');
    expect(screen.getByTestId('home-week-ring-arc').props.stroke).toEqual(
      svgColor(lightColors.accentEnergy),
    );
    expect(screen.getByLabelText('Weight toward your goal')).toBeOnTheScreen();
    expect(screen.getByText('80 kg → 76 kg')).toBeOnTheScreen();
  });

  it('turns the ring green and says so once the week is complete', async () => {
    await render(
      <GoalCard summary={{ ...TRAINING, week: { done: 4, goal: 4, complete: true } }} />,
    );

    expect(screen.getByRole('header', { name: 'Week complete!' })).toBeOnTheScreen();
    expect(screen.getByTestId('home-goal-status')).toHaveTextContent('You did every workout');
    expect(screen.getByTestId('home-week-ring-arc').props.stroke).toEqual(
      svgColor(lightColors.success),
    );
  });

  it('says one workout is left in the singular', async () => {
    await render(
      <GoalCard summary={{ ...TRAINING, week: { done: 3, goal: 4, complete: false } }} />,
    );

    expect(screen.getByTestId('home-goal-status')).toHaveTextContent('1 workout to go');
  });

  it('shows the empty states without a plan or a target weight', async () => {
    await render(<GoalCard summary={EMPTY} />);

    expect(screen.getByLabelText('No weekly plan yet')).toBeOnTheScreen();
    expect(screen.getByTestId('home-goal-status')).toHaveTextContent(
      'Complete your profile to get a weekly plan.',
    );
    expect(screen.getByText('Set a target weight to track it here.')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-weight-bar')).toBeNull();
  });

  it('renders in Spanish', async () => {
    mockLanguage = 'es';
    await render(<GoalCard summary={TRAINING} />);

    expect(screen.getByRole('header', { name: 'Tu meta te espera' })).toBeOnTheScreen();
    expect(screen.getByLabelText('2 de 4 entrenamientos esta semana')).toBeOnTheScreen();
    expect(screen.getByTestId('home-goal-status')).toHaveTextContent('Faltan 2 entrenamientos');
  });
});

describe('CoachCard', () => {
  it("offers 'Empezar' for today's session and opens Entrenamientos", async () => {
    mockLanguage = 'es';
    await render(<CoachCard summary={TRAINING} />);

    expect(screen.getByTestId('home-coach-message')).toHaveTextContent(
      'Hoy toca entrenamiento de cuerpo completo, 45 minutos.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Empezar el entrenamiento de hoy' }));
    expect(router().navigate).toHaveBeenCalledWith('/workouts');
  });

  it("replaces the button once today's session is done", async () => {
    mockLanguage = 'es';
    await render(
      <CoachCard
        summary={{
          ...TRAINING,
          coach: 'today-done',
          today: { kind: 'training', minutes: 45, completed: true },
        }}
      />,
    );

    expect(screen.queryByTestId('home-coach-start')).toBeNull();
    expect(screen.getByText('Entrenamiento de hoy completado')).toBeOnTheScreen();
  });

  it('says the whole week is done once it is', async () => {
    mockLanguage = 'es';
    await render(
      <CoachCard
        summary={{
          ...TRAINING,
          coach: 'week-done',
          week: { done: 4, goal: 4, complete: true },
          today: { kind: 'rest', active: true },
        }}
      />,
    );

    expect(screen.queryByTestId('home-coach-start')).toBeNull();
    expect(screen.getByText('Entrenamientos de esta semana completados')).toBeOnTheScreen();
    expect(screen.queryByText('Entrenamiento de hoy completado')).toBeNull();
  });

  it.each([
    [true, 'Active recovery today: walk 20 minutes and stretch 10.'],
    [false, 'Rest day today. Recover well.'],
  ] as const)('describes a rest day (active %s) with no start button', async (active, text) => {
    await render(
      <CoachCard summary={{ ...TRAINING, coach: 'rest', today: { kind: 'rest', active } }} />,
    );

    expect(screen.getByTestId('home-coach-message')).toHaveTextContent(text);
    expect(screen.queryByTestId('home-coach-start')).toBeNull();
  });

  it('asks for the missing inputs without a plan', async () => {
    await render(<CoachCard summary={EMPTY} />);

    expect(screen.getByTestId('home-coach-message')).toHaveTextContent(
      'Complete your profile and goal so the iCoach can plan your week.',
    );
    expect(screen.queryByTestId('home-coach-start')).toBeNull();
  });
});

describe('TodayTiles', () => {
  it("shows today's training and calories with their bar", async () => {
    await render(<TodayTiles summary={TRAINING} />);

    expect(screen.getByTestId('home-tile-training')).toHaveTextContent('Workout45 min');
    expect(screen.getByTestId('home-tile-calories')).toHaveTextContent(
      'Calories1,250 of 2,500 kcal',
    );
    expect(screen.getByLabelText('Calories eaten today')).toBeOnTheScreen();
  });

  it('shows the empty states without a plan or a calorie target', async () => {
    await render(<TodayTiles summary={EMPTY} />);

    expect(screen.getByTestId('home-tile-training')).toHaveTextContent('WorkoutNo plan yet');
    expect(screen.getByTestId('home-tile-calories')).toHaveTextContent('CaloriesNo target yet');
    expect(screen.queryByTestId('home-calories-bar')).toBeNull();
  });
});

describe('QuickActions', () => {
  it.each([
    ['home-quick-food', '/food-log'],
    ['home-quick-workout', '/workout-log'],
    ['home-quick-weight', '/progress'],
  ] as const)('%s opens %s', async (testID, href) => {
    await render(<QuickActions />);
    await fireEvent.press(screen.getByTestId(testID));
    expect(router().push).toHaveBeenCalledWith(href);
  });
});

describe('ComingSoonCard', () => {
  it('announces water and heart rate without inventing values', async () => {
    mockLanguage = 'es';
    await render(<ComingSoonCard />);

    expect(screen.getByRole('header', { name: 'Próximamente' })).toBeOnTheScreen();
    expect(screen.getByText('Agua — vasos al día, desde tu reloj inteligente')).toBeOnTheScreen();
    expect(
      screen.getByText('Ritmo cardíaco — en tiempo real, desde tu reloj inteligente'),
    ).toBeOnTheScreen();
  });
});
