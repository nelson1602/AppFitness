import { render, screen, waitFor } from '@testing-library/react-native';

import type { WorkoutRoutineSelection } from '../application/workout-routine.service';
import { GeneratedWorkoutPlan, GeneratedWorkoutPlanView } from './GeneratedWorkoutPlan';

let mockLanguage: 'en' | 'es' = 'en';
let mockDashboardState: Record<string, unknown>;
let mockProfileState: Record<string, unknown>;

const mockRefreshDashboard = jest.fn();
const mockLoadProfile = jest.fn();

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

jest.mock('@/features/dashboard/application/dashboard.store', () => ({
  useDashboardStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockDashboardState),
}));

jest.mock('@/features/profile/application/profile.store', () => ({
  useProfileStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockProfileState),
}));

const readySelection: WorkoutRoutineSelection = {
  status: 'ready',
  availableEquipment: ['dumbbell'],
  unsupportedEquipment: [],
  routine: {
    contractVersion: 'workout-routine-contract@1.0.0',
    ruleVersion: 'workout-routine-rules@1.0.0',
    exerciseCatalogVersion: 'exercise-catalog@0.2.0',
    schedule: [
      { weekday: 'MONDAY', kind: 'TRAINING', sessionKey: 'session.full_body_1' },
      { weekday: 'TUESDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
      { weekday: 'WEDNESDAY', kind: 'RECOVERY', recovery: 'ACTIVE_RECOVERY' },
      { weekday: 'THURSDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
      { weekday: 'FRIDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
      { weekday: 'SATURDAY', kind: 'RECOVERY', recovery: 'ACTIVE_RECOVERY' },
      { weekday: 'SUNDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
    ],
    sessions: [
      {
        key: 'session.full_body_1',
        focusKey: 'workout.focus.full_body',
        exercises: [
          {
            exerciseKey: 'exercise.back_squat',
            sets: 3,
            target: { kind: 'REPETITIONS', min: 8, max: 12 },
            restSeconds: 90,
            targetRpe: 7,
            substitutions: [
              {
                exerciseKey: 'exercise.goblet_squat',
                compatibleEquipment: ['dumbbell'],
              },
            ],
            explanationKeys: ['workout.exercise.pattern.squat'],
          },
        ],
      },
    ],
    progression: [
      {
        id: 'progression.external_load',
        strategy: 'DOUBLE_PROGRESSION',
        appliesToExerciseKeys: ['exercise.back_squat'],
        requiredSuccessfulSessions: 2,
        loadIncreasePct: 2.5,
        repetitionIncrease: null,
        durationIncreaseSeconds: null,
        explanationKey: 'workout.progression.external_load',
      },
    ],
    explanationKeys: ['workout.plan.goal.general_health'],
  },
};

describe('GeneratedWorkoutPlan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    mockDashboardState = {
      status: 'ready',
      data: null,
      refresh: mockRefreshDashboard,
    };
    mockProfileState = {
      status: 'ready',
      profile: null,
      load: mockLoadProfile,
    };
  });

  it('loads missing dashboard/profile state and exposes an accessible loading state', async () => {
    mockDashboardState.status = 'idle';
    mockProfileState.status = 'idle';

    await render(<GeneratedWorkoutPlan />);

    expect(screen.getByText('Building your workout plan…')).toBeOnTheScreen();
    await waitFor(() => {
      expect(mockRefreshDashboard).toHaveBeenCalledTimes(1);
      expect(mockLoadProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the complete English prescription and progression', async () => {
    await render(<GeneratedWorkoutPlanView selection={readySelection} />);

    expect(screen.getByText('Your weekly iCoach plan')).toBeOnTheScreen();
    expect(screen.getByText(/Monday: Training/)).toBeOnTheScreen();
    expect(screen.getAllByText('Back squat')).toHaveLength(2);
    expect(screen.getByText(/3 sets.*8–12 reps.*90 seconds rest.*target RPE 7/)).toBeOnTheScreen();
    expect(screen.getByText(/Substitutions: Goblet squat/)).toBeOnTheScreen();
    expect(
      screen.getByText(/After successful sessions 2: increase load by 2.5%/),
    ).toBeOnTheScreen();
  });

  it('translates presentation copy and exercise names without changing routine data', async () => {
    const original = JSON.stringify(readySelection);
    mockLanguage = 'es';

    await render(<GeneratedWorkoutPlanView selection={readySelection} />);

    expect(screen.getByText('Tu plan semanal de iCoach')).toBeOnTheScreen();
    expect(screen.getByText(/Lunes: Entrenamiento/)).toBeOnTheScreen();
    expect(screen.getAllByText('Sentadilla trasera')).toHaveLength(2);
    expect(screen.getByText(/Sustituciones: Sentadilla goblet/)).toBeOnTheScreen();
    expect(
      screen.getByText(/Después de sesiones exitosas 2: aumenta la carga en 2,5%/),
    ).toBeOnTheScreen();
    expect(JSON.stringify(readySelection)).toBe(original);
  });

  it.each([
    ['gap', 'Complete your baseline first'],
    ['blocked', 'Workout plan unavailable'],
    // ADR-P031 §Decision 15: insufficient coverage keeps the Error tone but
    // gets its own calm, non-blaming copy — it is a catalogue limitation.
    ['error', 'A full week could not be built yet'],
  ] as const)('renders the safe %s state', async (status, title) => {
    const selection: WorkoutRoutineSelection =
      status === 'error'
        ? { status, code: 'INSUFFICIENT_CATALOG_COVERAGE', missingPatterns: ['SQUAT'] }
        : { status };
    await render(<GeneratedWorkoutPlanView selection={selection} />);
    expect(screen.getByText(title)).toBeOnTheScreen();
  });

  it('surfaces unsupported profile equipment without blocking a valid routine', async () => {
    await render(
      <GeneratedWorkoutPlanView
        selection={{ ...readySelection, unsupportedEquipment: ['bench attachment'] }}
      />,
    );
    expect(screen.getByText('Equipment not recognized')).toBeOnTheScreen();
    expect(screen.getByText(/bench attachment/)).toBeOnTheScreen();
    expect(screen.getAllByText('Back squat')).toHaveLength(2);
  });
  // ── ADR-P031 W-4C/W-4D presentation (tests D15, G31, I34) ────────────────

  describe('the wellness Error arms', () => {
    const profile = {
      equipment: ['dumbbells', 'barbell', 'bench', 'pull-up bar', 'kettlebell'],
      sessionDurationMins: 45,
    };

    it('D15: an unreadable declaration renders the Error treatment, not a plan', async () => {
      mockDashboardState = {
        status: 'error',
        data: { wellness: 'unavailable', assessment: null },
        refresh: mockRefreshDashboard,
      };
      mockProfileState = { status: 'ready', profile, load: mockLoadProfile };

      await render(<GeneratedWorkoutPlan />);

      expect(screen.getByText('Your plan is on hold')).toBeOnTheScreen();
      // No plan, no schedule, no exercise — nothing presented as personalized.
      expect(screen.queryByText('Your weekly iCoach plan')).not.toBeOnTheScreen();
      expect(screen.queryByText('Back squat')).not.toBeOnTheScreen();
      // And it is not the first-run Data-gap arm either.
      expect(screen.queryByText('Complete your baseline first')).not.toBeOnTheScreen();
    });

    it('D15: the unreadable state names no field, reason or token', async () => {
      mockDashboardState = {
        status: 'error',
        data: { wellness: 'unavailable', assessment: null },
        refresh: mockRefreshDashboard,
      };
      mockProfileState = { status: 'ready', profile, load: mockLoadProfile };

      await render(<GeneratedWorkoutPlan />);

      const body = screen.getByText(/could not be read on this device/);
      expect(body).toBeOnTheScreen();
      for (const forbidden of ['movements_to_avoid', 'unknown-token', 'jumping', 'deep_squat']) {
        expect(screen.queryByText(new RegExp(forbidden))).not.toBeOnTheScreen();
      }
    });

    it('an unreadable declaration outranks the generic dashboard failure copy', async () => {
      mockDashboardState = {
        status: 'error',
        data: { wellness: 'unavailable', assessment: null },
        refresh: mockRefreshDashboard,
      };
      mockProfileState = { status: 'ready', profile, load: mockLoadProfile };

      await render(<GeneratedWorkoutPlan />);

      expect(screen.queryByText('Workout plan needs attention')).not.toBeOnTheScreen();
    });

    it('G31: passes the assessment’s own exclusions into selection, not []', async () => {
      const assessment = {
        assessment: {
          training: {
            blocked: false,
            requiresMedicalClearance: false,
            intensity: 'MODERATE',
            rpeCap: 8,
            daysPerWeek: 3,
            excludedMovements: ['dips', 'jumping'],
          },
        },
        engineInput: { goal: 'GENERAL_HEALTH', fitnessLevel: 'INTERMEDIATE' },
        notes: [],
      };
      mockDashboardState = {
        status: 'ready',
        data: { wellness: 'available', assessment },
        refresh: mockRefreshDashboard,
      };
      mockProfileState = { status: 'ready', profile, load: mockLoadProfile };

      await render(<GeneratedWorkoutPlan />);

      // A routine was produced, and none of its exercises match a declared
      // movement — the same list the assessment reports.
      await waitFor(() => expect(screen.getByText('Your weekly iCoach plan')).toBeOnTheScreen());
      for (const excluded of ['Parallel-bar dips', 'Box jump']) {
        expect(screen.queryByText(excluded)).not.toBeOnTheScreen();
      }
    });

    it('I34: the coverage error names no missing pattern', async () => {
      await render(
        <GeneratedWorkoutPlanView
          selection={{
            status: 'error',
            code: 'INSUFFICIENT_CATALOG_COVERAGE',
            missingPatterns: ['SQUAT', 'HINGE'],
          }}
        />,
      );

      expect(screen.getByText('A full week could not be built yet')).toBeOnTheScreen();
      expect(screen.getByText(/all being respected/)).toBeOnTheScreen();
      expect(screen.queryByText(/SQUAT/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/HINGE/)).not.toBeOnTheScreen();
    });

    it('keeps the generic error copy for a non-coverage failure', async () => {
      await render(
        <GeneratedWorkoutPlanView
          selection={{ status: 'error', code: 'INVALID_REQUEST', missingPatterns: [] }}
        />,
      );

      expect(screen.getByText('Workout plan needs attention')).toBeOnTheScreen();
    });

    it('renders both Error arms in Spanish too', async () => {
      mockLanguage = 'es';
      await render(
        <GeneratedWorkoutPlanView
          selection={{
            status: 'error',
            code: 'INSUFFICIENT_CATALOG_COVERAGE',
            missingPatterns: ['SQUAT'],
          }}
        />,
      );
      expect(screen.getByText('Todavía no se pudo armar una semana completa')).toBeOnTheScreen();
    });
  });
});
