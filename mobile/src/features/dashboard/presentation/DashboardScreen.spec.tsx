import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { signOut } from '@/features/authentication';
import type { DashboardData, DashboardState } from '../domain/dashboard.types';
import { DashboardScreen } from './DashboardScreen';

const refresh = jest.fn();
const syncNow = jest.fn();
const loadSampleData = jest.fn();

let mockStoreState: DashboardState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../application/dashboard.store', () => ({
  useDashboardStore: () => mockStoreState,
}));
jest.mock('@/features/authentication', () => ({
  signOut: jest.fn(),
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
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));
// Stub the cross-feature progress card so this test doesn't pull the progress
// store/repository; it only needs the pressable that forwards onPress.
jest.mock('@/features/progress', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ProgressSummaryCard: ({ onPress }: { onPress: () => void }) =>
      React.createElement(
        RN.Pressable,
        { accessibilityRole: 'button', accessibilityLabel: 'View your progress', onPress },
        React.createElement(RN.Text, null, 'Progress'),
      ),
  };
});

const baseData: DashboardData = {
  missing: [],
  sync: {
    pending: 0,
    inFlight: 0,
    failed: 0,
    conflicts: 0,
    status: 'idle',
    lastSyncedAt: null,
    message: null,
  },
  assessment: {
    engineInput: {
      subject: {
        age: 36,
        sex: 'MALE',
        heightCm: 178,
        weightKg: 82,
        bodyFatPct: 21,
      },
      activityLevel: 'MODERATE',
      goal: 'RECOMPOSITION',
      fitnessLevel: 'INTERMEDIATE',
      restrictions: [],
      trainingDaysPreference: 4,
    },
    notes: [],
    assessment: {
      ruleVersion: 'icoach-v1',
      bodyComposition: {
        bmi: 25.9,
        bmiCategory: 'OVERWEIGHT',
        leanBodyMassKg: 64.8,
        leanBodyMassMethod: 'BODY_FAT',
        bodyFatCategory: 'AVERAGE',
      },
      metabolics: {
        bmr: 1720,
        bmrMethod: 'KATCH_MCARDLE',
        activityMultiplier: 1.55,
        tdee: 2666,
      },
      nutrition: {
        calories: 2500,
        adjustmentPct: -6,
        proteinG: 164,
        carbsG: 280,
        fatG: 74,
        safetyFloorApplied: false,
      },
      training: {
        blocked: false,
        requiresMedicalClearance: false,
        intensity: 'MODERATE',
        rpeCap: 8,
        daysPerWeek: 4,
        excludedMovements: [],
      },
      recommendations: [
        {
          id: 'RECOVERY:sleep',
          category: 'RECOVERY',
          priority: 'MEDIUM',
          title: 'Protect sleep consistency',
          explanation: 'Recovery quality supports training adaptation.',
          scientificBasis: 'Deterministic iCoach v1 recovery rule.',
          ruleVersion: 'icoach-v1',
          inputs: {
            sleepHours: 7,
          },
        },
      ],
    },
  },
};

function setStore(partial: Partial<DashboardState>) {
  mockStoreState = {
    status: 'idle',
    data: null,
    error: null,
    refresh,
    syncNow,
    loadSampleData,
    ...partial,
  };
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
  });

  it('refreshes on mount and renders the loading skeleton', async () => {
    setStore({ status: 'loading' });

    await render(<DashboardScreen />);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.getAllByLabelText('Loading dashboard section')).toHaveLength(3);
  });

  it('renders the empty state and dev sample action', async () => {
    setStore({
      status: 'empty',
      data: {
        ...baseData,
        assessment: null,
        missing: [
          {
            id: 'weight',
            title: 'Add current weight',
            detail: 'A recent evaluation is required.',
          },
        ],
      },
    });

    await render(<DashboardScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Load fake sample dashboard data' }));

    expect(screen.getByText('Finish your baseline')).toBeOnTheScreen();
    expect(screen.getByText('Record a weight measurement')).toBeOnTheScreen();
    expect(loadSampleData).toHaveBeenCalledTimes(1);
  });

  it('deep-links a profile data gap to the profile edit screen', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({
      status: 'empty',
      data: {
        ...baseData,
        assessment: null,
        missing: [
          {
            id: 'profile',
            title: 'Create your profile',
            detail: 'Birth date, height, and training background are required.',
          },
        ],
      },
    });

    await render(<DashboardScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Fix: Create your profile' }));

    expect(router.push).toHaveBeenCalledWith('/profile-edit');
  });

  it('deep-links the weight data gap to the wellness progress screen', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({
      status: 'empty',
      data: {
        ...baseData,
        assessment: null,
        missing: [
          {
            id: 'weight',
            title: 'Record a weight measurement',
            detail: 'Weight is required for body composition and nutrition targets.',
          },
        ],
      },
    });

    await render(<DashboardScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Fix: Record a weight measurement' }));

    expect(router.push).toHaveBeenCalledWith('/progress');
  });

  it('deep-links the default-goal assessment note to the goal edit screen', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({
      status: 'ready',
      data: {
        ...baseData,
        missing: [
          {
            id: 'default-goal',
            title: 'Using maintenance goal',
            detail: 'Set a goal to personalize calorie and training adjustments.',
          },
        ],
      },
    });

    await render(<DashboardScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Fix: Using maintenance goal' }));

    expect(router.push).toHaveBeenCalledWith('/goal-edit');
  });

  it('renders recommendations and triggers manual sync', async () => {
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Synchronize local changes' }));

    expect(screen.getByText('2,500 kcal')).toBeOnTheScreen();
    expect(screen.getByText('iCoach recommendations')).toBeOnTheScreen();
    expect(screen.getByText('Protect sleep consistency')).toBeOnTheScreen();
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it('offers sign-out that clears the session (route guard handles redirect)', async () => {
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Sign out of your account' }));

    expect(jest.mocked(signOut)).toHaveBeenCalledTimes(1);
  });

  it('does not expose dormant medical management actions', async () => {
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    expect(screen.queryByText('Record evaluation')).toBeNull();
    expect(screen.queryByText('Evaluation history')).toBeNull();
    expect(screen.queryByText('Restrictions & injuries')).toBeNull();
  });

  it('navigates to the nutrition targets surface', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'View nutrition targets' }));

    expect(router.push).toHaveBeenCalledWith('/nutrition');
  });

  it('navigates to the dietary preferences surface', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Manage dietary preferences and allergies' }),
    );

    expect(router.push).toHaveBeenCalledWith('/dietary-preferences');
  });

  it('navigates to the workout routines surface', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Manage workout routines' }));

    expect(router.push).toHaveBeenCalledWith('/routines');
  });

  it('navigates to the workout logging surface', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log a workout' }));

    expect(router.push).toHaveBeenCalledWith('/workout-log');
  });

  it('navigates to the exercise library surface', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Manage your exercise library' }));

    expect(router.push).toHaveBeenCalledWith('/exercises');
  });

  it('navigates to the progress monitoring surface', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Track your progress' }));

    expect(router.push).toHaveBeenCalledWith('/progress');
  });

  it('navigates to progress from the summary card', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'View your progress' }));

    expect(router.push).toHaveBeenCalledWith('/progress');
  });

  it('routes to the delete-account surface (never deletes directly)', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Delete your account' }));

    expect(router.push).toHaveBeenCalledWith('/delete-account');
  });

  it('renders Spanish shell copy while preserving navigation routes', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockLanguage = 'es';
    setStore({ status: 'ready', data: baseData });

    await render(<DashboardScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Ver objetivos de nutrición' }));

    expect(screen.getByText('Tu evaluación local de iCoach')).toBeOnTheScreen();
    expect(screen.getByText('Recomendaciones de iCoach')).toBeOnTheScreen();
    expect(screen.getByText('Preferencias alimentarias')).toBeOnTheScreen();
    expect(screen.getByText('Rutinas de ejercicios')).toBeOnTheScreen();
    expect(screen.getByText('Cerrar sesión')).toBeOnTheScreen();
    expect(router.push).toHaveBeenCalledWith('/nutrition');
  });

  it('renders a distinct web-unavailable state in English with no retry or fabricated data (ADR-P019)', async () => {
    setStore({ status: 'web-unavailable', data: null, error: null });

    await render(<DashboardScreen />);

    expect(screen.getByText("Dashboard isn't available on the web")).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Your dashboard data lives on your device. Use the AppFitness mobile app for the full offline experience.',
      ),
    ).toBeOnTheScreen();
    // Not treated as a generic error, and offers no retry / sync control.
    expect(screen.queryByText('Dashboard unavailable')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Synchronize local changes' })).toBeNull();
    expect(screen.queryByText(/try again/i)).toBeNull();
    // No fabricated dashboard data.
    expect(screen.queryByText('iCoach recommendations')).toBeNull();
    expect(screen.queryByText('2,500 kcal')).toBeNull();
    // Loading skeleton is not shown in this state.
    expect(screen.queryByLabelText('Loading dashboard section')).toBeNull();
  });

  it('renders the web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'web-unavailable', data: null, error: null });

    await render(<DashboardScreen />);

    expect(screen.getByText('El panel no está disponible en la web')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Los datos de tu panel se guardan en tu dispositivo. Usa la app móvil de AppFitness para la experiencia completa sin conexión.',
      ),
    ).toBeOnTheScreen();
  });

  it('surfaces dashboard and sync error states with safe copy', async () => {
    setStore({
      status: 'error',
      error: 'The dashboard could not be loaded right now.',
      data: {
        ...baseData,
        sync: {
          ...baseData.sync,
          status: 'error',
          message: 'Sync needs attention.',
        },
      },
    });

    await render(<DashboardScreen />);

    expect(screen.getByText('Dashboard unavailable')).toBeOnTheScreen();
    expect(
      screen.getByText('Your dashboard could not be loaded right now. Please try again.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('The dashboard could not be loaded right now.')).toBeNull();
    expect(screen.getByText('Sync needs attention')).toBeOnTheScreen();
  });
});
