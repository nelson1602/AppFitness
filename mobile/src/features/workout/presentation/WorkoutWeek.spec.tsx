import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { GeneratedWorkoutRoutine } from '@/features/icoach';
import { otherLanguageStrings } from '@/shared/localization/language-leak.testkit';
import { en } from '@/shared/localization/resources/en';

import { BUILT_IN_EXERCISES } from '../infrastructure/exercise-catalog.data';
import { DEMO_MOTIONS, demoMotionFor } from '../domain/exercise-demo';
import { WorkoutWeek } from './WorkoutWeek';

let mockDone: Record<string, number> = {};
let mockSessionId: string | null = '2026-11-04|session-1';
const mockCompleteSession = jest.fn().mockResolvedValue(true);
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
        sessionId: mockSessionId,
        status: 'ready',
        completeSet: mockCompleteSet,
        completeSession: mockCompleteSession,
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

function renderWeek(
  todayIndex = 2,
  done: string[] = ['2026-11-02'],
  planStart: string | null = null,
  moves: readonly { sessionKey: string; from: string; to: string }[] = [],
) {
  return render(
    <WorkoutWeek
      doneDates={new Set(done)}
      moves={moves}
      notes={[{ code: 'plan.progression.up' }]}
      routine={ROUTINE}
      sessionMinutes={45}
      planStart={planStart}
      todayIndex={todayIndex}
      weekDates={DATES}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockDone = {};
  mockSessionId = '2026-11-04|session-1';
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
    expect(mockLoad).toHaveBeenCalledWith('session-1', undefined, '2026-11-04', '2026-11-04');
  });

  it('marks the week with Hecho / Hoy / Pendiente and colours the strip dots', async () => {
    await renderWeek();

    expect(screen.getByTestId('workout-week-row-0-status')).toHaveTextContent('Done');
    expect(screen.getByTestId('workout-week-row-2-status')).toHaveTextContent('Today');
    expect(screen.getByTestId('workout-week-row-4-status')).toHaveTextContent('Pending');
    // v8.1 round 2 (item 9): the prototype's gray chip on the week plan.
    expect(screen.getByTestId('workout-week-renews')).toHaveTextContent('Renews on Monday');
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
    expect(screen.getByTestId('workout-exercise-figure')).toHaveProp(
      'accessibilityLabel',
      'Figure doing Goblet squat',
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

// v10 Block A, item 2: days before the person started are not part of the plan.
describe('WorkoutWeek before the plan start', () => {
  it('leaves Monday out when the plan started on Wednesday', async () => {
    await renderWeek(2, [], '2026-11-04');
    expect(screen.queryByTestId('workout-week-row-0')).toBeNull();
    expect(screen.getByTestId('workout-week-row-2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monday, rest')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('workout-day-0'));
    expect(screen.getByTestId('workout-before-start')).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-session-panel')).toBeNull();
  });
});

// v10 Block A, item 3: an earlier day of this week can be logged with its date.
describe('WorkoutWeek logging an earlier day', () => {
  it('marks the Monday session done with the Monday date', async () => {
    await renderWeek(2, []);
    await fireEvent.press(screen.getByTestId('workout-day-0'));
    expect(mockLoad).toHaveBeenLastCalledWith('session-1', undefined, '2026-11-02', '2026-11-02');
    expect(screen.getByTestId('workout-exercise-0-set')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('workout-session-mark-done'));
    expect(mockCompleteSession).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-02', sessionKey: 'session-1' }),
    );
  });

  it('keeps later days read-only', async () => {
    await renderWeek(2, []);
    await fireEvent.press(screen.getByTestId('workout-day-4'));
    expect(screen.queryByTestId('workout-exercise-0-set')).toBeNull();
    expect(screen.queryByTestId('workout-session-mark-done')).toBeNull();
  });
});

// v10 Block A R3: the moved session shows, is logged and is done on its new day.
describe('WorkoutWeek with a session the iCoach moved', () => {
  const MOVE = [{ sessionKey: 'session-1', from: '2026-11-02', to: '2026-11-03' }];

  it('shows it on Tuesday in the strip and the week, and Monday as moved', async () => {
    await renderWeek(2, [], null, MOVE);
    expect(screen.getByLabelText('Tuesday, training')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monday, rest')).toBeOnTheScreen();
    expect(screen.getByTestId('workout-week-row-1')).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-week-row-0')).toBeNull();

    await fireEvent.press(screen.getByTestId('workout-day-0'));
    expect(screen.getByTestId('workout-moved-out')).toHaveTextContent(
      'The iCoach moved this session to Tuesday.',
    );
  });

  it('logs it on Tuesday for the Monday plan', async () => {
    await renderWeek(2, [], null, MOVE);
    await fireEvent.press(screen.getByTestId('workout-day-1'));
    expect(screen.getByTestId('workout-moved-in')).toHaveTextContent(
      'The iCoach moved it here from Monday.',
    );
    expect(mockLoad).toHaveBeenLastCalledWith('session-1', undefined, '2026-11-03', '2026-11-02');
    await fireEvent.press(screen.getByTestId('workout-session-mark-done'));
    expect(mockCompleteSession).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-03', planDate: '2026-11-02' }),
    );
  });

  it('marks Tuesday done once the Monday session is fulfilled there', async () => {
    await renderWeek(2, ['2026-11-02'], null, MOVE);
    expect(screen.getByTestId('workout-week-row-1-status')).toHaveTextContent('Done');
  });
});
