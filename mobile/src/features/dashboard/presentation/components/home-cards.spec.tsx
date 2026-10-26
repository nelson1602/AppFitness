import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { lightColors } from '@/shared/theme';

import type { HomeSummary } from '../../domain/home-summary';
import type { HomeEvaluation } from '../../application/use-home-data';
import {
  CoachCard,
  ComingSoonCard,
  EvaluationCard,
  GoalCard,
  QuickActions,
  TodayTiles,
} from './home-cards';

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
    await render(<GoalCard goalType={null} summary={TRAINING} />);

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
      <GoalCard
        goalType={null}
        summary={{ ...TRAINING, week: { done: 4, goal: 4, complete: true } }}
      />,
    );

    expect(screen.getByRole('header', { name: 'Week complete!' })).toBeOnTheScreen();
    expect(screen.getByTestId('home-goal-status')).toHaveTextContent(
      'You completed every workout this week',
    );
    expect(screen.getByTestId('home-week-ring-arc').props.stroke).toEqual(
      svgColor(lightColors.success),
    );
  });

  it('says one workout is left in the singular', async () => {
    await render(
      <GoalCard
        goalType={null}
        summary={{ ...TRAINING, week: { done: 3, goal: 4, complete: false } }}
      />,
    );

    expect(screen.getByTestId('home-goal-status')).toHaveTextContent('1 workout to go');
  });

  it('shows the empty states without a plan or a target weight', async () => {
    await render(<GoalCard goalType={null} summary={EMPTY} />);

    expect(screen.getByLabelText('No weekly plan yet')).toBeOnTheScreen();
    expect(screen.getByTestId('home-goal-status')).toHaveTextContent(
      'Complete your profile to get a weekly plan.',
    );
    expect(screen.getByText('Set a target weight to track it here.')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-weight-bar')).toBeNull();
  });

  it('renders in Spanish', async () => {
    mockLanguage = 'es';
    await render(<GoalCard goalType={null} summary={TRAINING} />);

    expect(screen.getByRole('header', { name: 'Tu meta te espera' })).toBeOnTheScreen();
    expect(screen.getByLabelText('2 de 4 entrenamientos esta semana')).toBeOnTheScreen();
    expect(screen.getByTestId('home-goal-status')).toHaveTextContent('Faltan 2 entrenamientos');
  });
});

describe('CoachCard', () => {
  it("offers 'Empezar' for today's session and opens Entrenamientos", async () => {
    mockLanguage = 'es';
    await render(<CoachCard evaluationDate={null} summary={TRAINING} />);

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
        evaluationDate={null}
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
        evaluationDate={null}
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
      <CoachCard
        evaluationDate={null}
        summary={{ ...TRAINING, coach: 'rest', today: { kind: 'rest', active } }}
      />,
    );

    expect(screen.getByTestId('home-coach-message')).toHaveTextContent(text);
    expect(screen.queryByTestId('home-coach-start')).toBeNull();
  });

  it('asks for the missing inputs without a plan', async () => {
    await render(<CoachCard evaluationDate={null} summary={EMPTY} />);

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
    expect(screen.getByTestId('home-calories-bar').props.accessibilityValue.now).toBe(0);
  });
});

describe('QuickActions', () => {
  it.each([
    ['home-quick-food', '/food-log'],
    ['home-quick-workout', '/workout-log'],
    ['home-quick-weight', '/progress-log'],
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
    expect(screen.getByTestId('home-soon-drop')).toHaveTextContent(
      'Aguavasos al día, desde tu reloj inteligente',
    );
    expect(screen.getByTestId('home-soon-heart')).toHaveTextContent(
      'Ritmo cardíacoen tiempo real, desde tu reloj inteligente',
    );
  });
});

describe('GoalCard design details', () => {
  it('names the goal, and carries the mascot and the heartbeat (decorative)', async () => {
    mockLanguage = 'es';
    await render(<GoalCard goalType="RECOMPOSITION" summary={TRAINING} />);

    expect(screen.getByTestId('home-goal-type')).toHaveTextContent('Recomposición corporal');
    expect(screen.queryByText(/perder grasa y ganar músculo/)).toBeNull();
    expect(screen.getByTestId('home-goal-mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('home-goal-pulse', { includeHiddenElements: true })).toBeTruthy();
  });
});

/**
 * Store review, 2026-10-26: on a 360 px phone the long goal name pushed the
 * weight off the card, and "Próximamente" broke mid-word beside its chip.
 * Jest has no layout engine, so these pin the flex contract that keeps both
 * rows whole on a 360 px window at 200 % text; the emulator re-shoot is the
 * visual check.
 */
describe('narrow window and large text (360 px, 200 %)', () => {
  const flat = (testID: string, options?: { includeHiddenElements: boolean }) =>
    StyleSheet.flatten(screen.getByTestId(testID, options).props.style) ?? {};

  beforeEach(() => {
    jest
      .spyOn(Dimensions, 'get')
      .mockImplementation(() => ({ width: 360, height: 780, scale: 3, fontScale: 2 }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['es', 'Recomposición corporal', /^74\skg → 68\skg$/],
    ['en', 'Body recomposition', /^74\skg → 68\skg$/],
  ] as const)(
    '%s: the goal card names the goal briefly and keeps the weight whole',
    async (language, goal, weight) => {
      mockLanguage = language;
      await render(
        <GoalCard
          goalType="RECOMPOSITION"
          summary={{
            ...TRAINING,
            weight: { current: 74, start: 77.6, target: 68, progress: 0.375 },
          }}
        />,
      );

      expect(screen.getByTestId('home-goal-type')).toHaveTextContent(goal);
      expect(screen.getByTestId('home-goal-weight')).toHaveTextContent(weight);
      // The name may wrap onto a second line; the weight may never shrink.
      expect(flat('home-goal-type')).toMatchObject({ flexShrink: 1 });
      expect(flat('home-goal-weight')).toMatchObject({ flexShrink: 0 });
    },
  );

  it.each([
    ['es', 'Próximamente', 'Actualización'],
    ['en', 'Coming soon', 'Future update'],
  ] as const)(
    '%s: "%s" keeps its natural width and lets the short chip wrap below it',
    async (language, title, chip) => {
      mockLanguage = language;
      await render(<ComingSoonCard />);

      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
      expect(screen.getByTestId('home-soon-chip')).toHaveTextContent(chip);
      expect(flat('panel-title-row')).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
      // `flex: 1` would zero the title's basis, so the row never wraps and the
      // title is squeezed until a word breaks. A content basis wraps the chip.
      const main = flat('panel-title-main');
      expect(main).toMatchObject({ flexGrow: 1, flexShrink: 1 });
      expect(main).not.toHaveProperty('flex');
      expect(main).not.toHaveProperty('flexBasis');
    },
  );
});

describe('CoachCard evaluation footer', () => {
  it('says which evaluation the recommendation is based on', async () => {
    mockLanguage = 'es';
    await render(<CoachCard evaluationDate="2026-09-01" summary={TRAINING} />);

    expect(screen.getByText('Según tu evaluación del 1 de septiembre')).toBeOnTheScreen();
  });
});

describe('EvaluationCard', () => {
  const EVALUATION: HomeEvaluation = {
    bmi: 25.84,
    bmiCategory: 'OVERWEIGHT',
    macros: [
      { kind: 'protein', target: 150, consumed: 60 },
      { kind: 'carbs', target: 250, consumed: 125.4 },
      { kind: 'fat', target: 70, consumed: null },
    ],
  };

  it('shows the BMI with its category and each macro eaten against its target', async () => {
    mockLanguage = 'es';
    await render(<EvaluationCard evaluation={EVALUATION} />);

    expect(screen.getByRole('header', { name: 'Tu evaluación de hoy' })).toBeOnTheScreen();
    expect(screen.getByTestId('home-eval-bmi')).toHaveTextContent('25,8');
    expect(screen.getByText('sobrepeso')).toBeOnTheScreen();
    expect(screen.getByTestId('home-eval-protein')).toHaveTextContent('Proteína60 / 150 g');
    expect(screen.getByTestId('home-eval-carbs')).toHaveTextContent('Carbohidratos125 / 250 g');
    expect(screen.getByTestId('home-eval-fat')).toHaveTextContent('Grasa0 / 70 g');
    expect(screen.getByLabelText('Proteína: 60 de 150 g hoy')).toBeOnTheScreen();
  });

  it('never shows blood pressure (medical, ADR-P038)', async () => {
    mockLanguage = 'es';
    await render(<EvaluationCard evaluation={EVALUATION} />);
    expect(screen.queryByText(/Presión/)).toBeNull();
  });

  it('asks for the profile before the assessment can compute', async () => {
    await render(<EvaluationCard evaluation={null} />);
    expect(screen.getByText('Complete your profile to see your evaluation.')).toBeOnTheScreen();
  });
});
