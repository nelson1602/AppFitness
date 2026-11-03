import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { GeneratedWorkoutRoutine } from '@/features/icoach';
import { otherLanguageStrings } from '@/shared/localization/language-leak.testkit';
import { en } from '@/shared/localization/resources/en';

import { BUILT_IN_EXERCISES } from '../infrastructure/exercise-catalog.data';
import { DEMO_MOTIONS, demoMotionFor } from '../domain/exercise-demo';
import { WorkoutWeek } from './WorkoutWeek';

let mockDone: Record<string, number> = {};
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const resources = {
    en: jest.requireActual('@/shared/localization/resources/en').en,
    es: jest.requireActual('@/shared/localization/resources/es').es,
  };
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => resources[mockLanguage][key],
    }),
  };
});
const mockCompleteSet = jest.fn(() => Promise.resolve(true));
const mockLoad = jest.fn();

jest.mock('../application/planned-session.store', () => {
  const actual = jest.requireActual('../application/planned-session.store');
  return {
    ...actual,
    usePlannedSessionStore: (select: (state: unknown) => unknown) =>
      select({
        done: mockDone,
        status: 'ready',
        completeSet: mockCompleteSet,
        load: mockLoad,
      }),
  };
});

const ROUTINE = {
  sessions: [
    {
      key: 'session-1',
      exercises: [
        {
          exerciseKey: 'exercise.goblet_squat',
          sets: 2,
          target: { kind: 'REPETITIONS', min: 10, max: 12 },
          restSeconds: 60,
          targetRpe: 7,
          substitutions: [],
        },
        {
          exerciseKey: 'exercise.plank',
          sets: 2,
          target: { kind: 'DURATION', seconds: 30 },
          restSeconds: 30,
          targetRpe: 6,
          substitutions: [],
        },
      ],
    },
  ],
  schedule: [
    { weekday: 'MONDAY', kind: 'TRAINING', sessionKey: 'session-1' },
    { weekday: 'TUESDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
    { weekday: 'WEDNESDAY', kind: 'TRAINING', sessionKey: 'session-1' },
    { weekday: 'THURSDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
    { weekday: 'FRIDAY', kind: 'TRAINING', sessionKey: 'session-1' },
    { weekday: 'SATURDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
    { weekday: 'SUNDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
  ],
} as unknown as GeneratedWorkoutRoutine;

const DATES = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
];

function renderWeek(todayIndex = 2, done: string[] = ['2026-11-02']) {
  return render(
    <WorkoutWeek
      doneDates={new Set(done)}
      notes={[{ code: 'plan.progression.up' }]}
      routine={ROUTINE}
      sessionMinutes={45}
      todayIndex={todayIndex}
      weekDates={DATES}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockDone = {};
  mockLanguage = 'en';
});

describe('WorkoutWeek (v8.1, prototype Entrenamientos)', () => {
  it('opens on today with the session, its minutes, an iCoach note and set progress', async () => {
    await renderWeek();

    expect(screen.getByTestId('workout-day-2').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByTestId('workout-session-minutes')).toHaveTextContent('45 min');
    expect(screen.getByTestId('workout-notes')).toHaveTextContent(en['plan.note.up']);
    expect(screen.getByText('0/4 sets')).toBeOnTheScreen();
    expect(screen.getByText('2 × 10–12')).toBeOnTheScreen();
    expect(screen.getByText('2 × 30 s')).toBeOnTheScreen();
    expect(mockLoad).toHaveBeenCalledWith('session-1');
  });

  it('marks the week with Hecho / Hoy / Pendiente and colours the strip dots', async () => {
    await renderWeek();

    expect(screen.getByTestId('workout-week-row-0-status')).toHaveTextContent('Done');
    expect(screen.getByTestId('workout-week-row-2-status')).toHaveTextContent('Today');
    expect(screen.getByTestId('workout-week-row-4-status')).toHaveTextContent('Pending');
    // Rest days have no dot.
    expect(screen.getByTestId('workout-day-1-dot')).toHaveStyle({
      backgroundColor: 'transparent',
    });
  });

  it('completes the next set, fills its pill and starts the rest timer', async () => {
    mockDone = { 'exercise.goblet_squat': 1 };
    await renderWeek();

    expect(screen.getByText('1/4 sets')).toBeOnTheScreen();
    const button = screen.getByTestId('workout-exercise-0-set');
    expect(button).toHaveTextContent('Set 2');
    await fireEvent.press(button);

    expect(mockCompleteSet).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: 'session-1',
        exercise: { exerciseKey: 'exercise.goblet_squat', sets: 2, reps: 12 },
      }),
    );
    expect(await screen.findByTestId('workout-rest-timer')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('workout-rest-skip'));
    expect(screen.queryByTestId('workout-rest-timer')).toBeNull();
  });

  it('shows the completed state when every planned set is done', async () => {
    mockDone = { 'exercise.goblet_squat': 2, 'exercise.plank': 2 };
    await renderWeek();

    expect(screen.getByTestId('workout-session-complete')).toBeOnTheScreen();
    expect(screen.getByTestId('workout-exercise-0-set')).toBeDisabled();
  });

  it('offers "Serie N" only on today; other days show the plan', async () => {
    await renderWeek();
    await fireEvent.press(screen.getByTestId('workout-day-4'));

    expect(screen.getByTestId('workout-session-panel')).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-exercise-0-set')).toBeNull();
  });

  it('shows the rest day panel on a recovery day', async () => {
    await renderWeek();
    await fireEvent.press(screen.getByTestId('workout-day-1'));

    expect(screen.getByTestId('workout-rest-day')).toHaveTextContent(en['workout.plan.restDay'], {
      exact: false,
    });
  });

  it('toggles "Ver cómo se hace" with the three cues of the movement', async () => {
    await renderWeek();
    await fireEvent.press(screen.getByTestId('workout-exercise-0-demo-toggle'));

    expect(screen.getByTestId('workout-exercise-demo')).toHaveTextContent(
      en['workout.demo.squat.cue1'],
      { exact: false },
    );
    expect(screen.getByText('Hide demonstration')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('workout-exercise-0-demo-toggle'));
    expect(screen.queryByTestId('workout-exercise-demo')).toBeNull();
  });

  it('counts the rest timer down and closes it at zero', async () => {
    jest.useFakeTimers();
    await renderWeek();
    await fireEvent.press(screen.getByTestId('workout-exercise-1-set'));
    expect(screen.getByTestId('workout-rest-timer')).toHaveTextContent(/0:(30|29)/);

    for (let second = 0; second < 32; second += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(screen.queryByTestId('workout-rest-timer')).toBeNull();
  });
});

describe('exercise demo mapping', () => {
  it('maps every built-in exercise to a movement with cues', () => {
    for (const exercise of BUILT_IN_EXERCISES) {
      expect(DEMO_MOTIONS).toContain(demoMotionFor(exercise.key));
    }
    for (const motion of DEMO_MOTIONS) {
      for (const n of [1, 2, 3]) {
        expect(en[`workout.demo.${motion}.cue${n}` as keyof typeof en]).toBeTruthy();
      }
    }
  });
});

// v8.1 guard: no string of the other language on this tab, in either language.
describe('WorkoutWeek language guard (v8.1)', () => {
  it.each(['en', 'es'] as const)(
    'renders no copy of the other language in %s',
    async (language) => {
      mockLanguage = language;
      mockDone = { 'exercise.goblet_squat': 1 };
      await renderWeek();
      await fireEvent.press(screen.getByTestId('workout-exercise-0-demo-toggle'));
      expect(otherLanguageStrings(screen.root, language)).toEqual([]);
    },
  );
});
