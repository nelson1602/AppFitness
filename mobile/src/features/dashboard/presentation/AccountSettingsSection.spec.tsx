import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';

import type { DashboardData, DashboardState } from '../domain/dashboard.types';
import type { HomeSummary } from '../domain/home-summary';
import { AccountSettingsSection } from './AccountSettingsSection';
import {
  beginEntitlementCheck,
  configureEntitlementEnforcement,
  setEntitlementAccess,
} from '@/shared/application/entitlement-access';

const refresh = jest.fn();
const syncNow = jest.fn();
const loadSampleData = jest.fn();

let mockStoreState: DashboardState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../application/dashboard.store', () => ({
  useDashboardStore: () => mockStoreState,
}));

// Inicio's summary is a pure domain projection with its own spec
// (home-summary.spec.ts); here it is supplied directly so each card state can
// be rendered without loading seven stores.
const EMPTY_SUMMARY: HomeSummary = {
  week: { done: 0, goal: null, complete: false },
  weight: null,
  today: { kind: 'unknown' },
  coach: 'no-plan',
  calories: { consumed: null, target: null, share: null },
};
let mockHomeSummary: HomeSummary = EMPTY_SUMMARY;
const mockLoadHomeData = jest.fn();
jest.mock('../application/use-home-data', () => ({
  loadHomeData: () => mockLoadHomeData(),
  useHomeData: () => ({ summary: mockHomeSummary, notifications: [] }),
}));
jest.mock('@/features/authentication', () => ({
  // The dashboard now renders the advisory verification reminder (ADR-P026
  // V2-D). These tests assert the dashboard shell, so the reminder is held in
  // its hidden arm — no session means it returns null and every existing
  // assertion here is unaffected. Its own behaviour is covered by
  // verification-reminder-card.spec.tsx.
  useSession: () => ({ status: 'unauthenticated', session: null }),
  subscribeToReminder: () => () => {},
  dismissedUserSnapshot: () => null,
  dismissReminder: jest.fn(),
  resendVerification: jest.fn(),
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
// A faithful-enough double of expo-router's useFocusEffect (v57): it runs the
// effect on registration (mirroring the initial-mount focus) and exposes the
// latest registered callback so tests can simulate a later refocus — e.g.
// returning from Progress via `back` — without a real navigation container.
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), navigate: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});
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

jest.mock('@/features/wellness', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    WellnessSafetyRecommendationCard: ({ onOpen }: { onOpen: () => void }) =>
      React.createElement(
        RN.Pressable,
        { accessibilityRole: 'button', accessibilityLabel: 'wellness-cta', onPress: onOpen },
        React.createElement(RN.Text, { testID: 'wellness-recommendation' }, 'Recommendation'),
      ),
  };
});

const baseData: DashboardData = {
  wellness: 'absent',
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

describe('AccountSettingsSection (Perfil → Cuenta y ajustes, ADR-P039)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    mockHomeSummary = EMPTY_SUMMARY;
  });

  it('renders the first-run checklist and dev sample action on the empty state', async () => {
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

    await render(<AccountSettingsSection />);
    fireEvent.press(screen.getByRole('button', { name: 'Load fake sample dashboard data' }));

    expect(screen.getByText('Finish setting up AppFitnessRD')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-step-weight')).toBeOnTheScreen();
    expect(loadSampleData).toHaveBeenCalledTimes(1);
  });

  it('counts resolved steps and drops them from the checklist', async () => {
    setStore({
      status: 'empty',
      data: {
        ...baseData,
        assessment: null,
        // Profile and goal are resolved; only the weight step remains.
        missing: [
          {
            id: 'weight',
            title: 'Add current weight',
            detail: 'A recent evaluation is required.',
          },
        ],
      },
    });

    await render(<AccountSettingsSection />);

    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('2 of 3 complete');
    expect(screen.getByTestId('onboarding-step-weight')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding-step-profile')).toBeNull();
    expect(screen.queryByTestId('onboarding-step-goal')).toBeNull();
  });

  it('groups the three profile-side gaps into a single checklist step', async () => {
    setStore({
      status: 'empty',
      data: {
        ...baseData,
        assessment: null,
        missing: [
          { id: 'profile', title: 'Create your profile', detail: '' },
          { id: 'birth-date', title: 'Add your birth date', detail: '' },
          { id: 'height', title: 'Add your height', detail: '' },
        ],
      },
    });

    await render(<AccountSettingsSection />);

    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('2 of 3 complete');
    expect(screen.getAllByTestId(/^onboarding-step-/)).toHaveLength(1);
    expect(screen.getByTestId('onboarding-step-profile')).toBeOnTheScreen();
  });

  it('renders the checklist in Spanish with localized counts', async () => {
    mockLanguage = 'es';
    setStore({
      status: 'empty',
      data: {
        ...baseData,
        assessment: null,
        missing: [{ id: 'default-goal', title: 'Elige tu objetivo', detail: '' }],
      },
    });

    await render(<AccountSettingsSection />);

    expect(screen.getByText('Termina de configurar AppFitnessRD')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('2 de 3 completados');
    expect(screen.getByTestId('onboarding-step-goal')).toHaveTextContent('Elige tu objetivo');
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

    await render(<AccountSettingsSection />);
    fireEvent.press(screen.getByRole('button', { name: 'Fix: Add your profile basics' }));

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

    await render(<AccountSettingsSection />);
    fireEvent.press(screen.getByRole('button', { name: 'Fix: Record your first weight' }));

    expect(router.push).toHaveBeenCalledWith('/progress-log');
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

    await render(<AccountSettingsSection />);
    await fireEvent.press(screen.getByTestId('profile-recommendations'));
    fireEvent.press(screen.getByRole('button', { name: 'Fix: Using maintenance goal' }));

    expect(router.push).toHaveBeenCalledWith('/goal-edit');
  });

  it('keeps the assessment and recommendations behind one row, and syncs on demand', async () => {
    setStore({ status: 'ready', data: baseData });

    await render(<AccountSettingsSection />);
    expect(screen.queryByText('Protect sleep consistency')).toBeNull();
    expect(screen.getByTestId('profile-recommendations')).toHaveTextContent(
      'iCoach recommendations1 from your evaluation',
    );
    await fireEvent.press(screen.getByTestId('profile-recommendations'));
    // Sync is one compact row now: its name says the action and the state.
    fireEvent.press(screen.getByTestId('dashboard-sync-now'));
    expect(screen.getByTestId('dashboard-sync-now').props.accessibilityLabel).toBe(
      'Synchronize local changes. Local data ready. Dashboard is available offline.',
    );

    expect(screen.getByText('2,500 kcal')).toBeOnTheScreen();
    expect(screen.getByText('Protect sleep consistency')).toBeOnTheScreen();
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it('does not expose dormant medical management actions', async () => {
    setStore({ status: 'ready', data: baseData });

    await render(<AccountSettingsSection />);
    expect(screen.queryByText('Record evaluation')).toBeNull();
    expect(screen.queryByText('Evaluation history')).toBeNull();
    expect(screen.queryByText('Restrictions & injuries')).toBeNull();
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

    await render(<AccountSettingsSection />);

    expect(screen.getByText('Dashboard unavailable')).toBeOnTheScreen();
    expect(
      screen.getByText('Your dashboard could not be loaded right now. Please try again.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('The dashboard could not be loaded right now.')).toBeNull();
    expect(screen.getByText('Sync needs attention')).toBeOnTheScreen();
  });

  // ── ADR-P017 W-3 ─────────────────────────────────────────────────────────

  it('shows the wellness recommendation without changing the three-step onboarding count', async () => {
    setStore({
      status: 'empty',
      data: {
        ...baseData,
        assessment: null,
        missing: [{ id: 'weight', title: 'Add current weight', detail: '' }],
      },
    });

    await render(<AccountSettingsSection />);

    // The recommendation renders as its own card…
    expect(screen.getByTestId('wellness-recommendation')).toBeOnTheScreen();
    // …and the shipped checklist still counts exactly three steps, with the
    // same single outstanding row. It is a recommendation, not a prerequisite.
    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('2 of 3 complete');
    expect(screen.getAllByTestId(/^onboarding-step-/)).toHaveLength(1);
  });

  it('opens the capture surface from the recommendation call to action', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    setStore({ status: 'ready', data: baseData });

    await render(<AccountSettingsSection />);
    fireEvent.press(screen.getByRole('button', { name: 'wellness-cta' }));

    expect(router.push).toHaveBeenCalledWith('/wellness-safety-profile');
  });

  describe('an unreadable wellness declaration', () => {
    const unreadable = (): DashboardState => ({
      status: 'error',
      data: { ...baseData, wellness: 'unavailable', assessment: null },
      error: null,
      refresh,
      syncNow,
      loadSampleData,
    });

    it('D15: renders the canonical Error treatment with the wellness copy', async () => {
      mockStoreState = unreadable();

      await render(<AccountSettingsSection />);

      expect(screen.getByText('Your plan is on hold')).toBeOnTheScreen();
      expect(screen.getByText(/could not be read on this device/)).toBeOnTheScreen();
    });

    it('D15: shows no assessment, no recommendations and no first-run checklist', async () => {
      mockStoreState = unreadable();

      await render(<AccountSettingsSection />);

      expect(screen.queryByText('Recommendations')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('onboarding-checklist')).not.toBeOnTheScreen();
      // Not the generic failure banner either: `error` is deliberately unset.
      expect(screen.queryByText('Dashboard unavailable')).not.toBeOnTheScreen();
    });

    it('offers the same recovery W-3 does — reviewing the answers', async () => {
      mockStoreState = unreadable();

      await render(<AccountSettingsSection />);

      // The recovery is the entry that is always there, not a new control:
      // the copy points at it, and this Error state adds no affordance of
      // its own. Since ADR-P039 that entry is on the Perfil tab, one tap away
      // in the tab bar (ProfileTab.spec.tsx).
      expect(screen.queryByTestId('dashboard-wellness-safety')).toBeNull();
      expect(screen.getByText(/Open your evaluation and limitations/)).toBeOnTheScreen();
    });

    it('names no field, reason or token', async () => {
      mockStoreState = unreadable();

      await render(<AccountSettingsSection />);

      for (const forbidden of [
        'movements_to_avoid',
        'affected_areas',
        'unknown-token',
        'tombstone',
        'conflict',
        'jumping',
      ]) {
        expect(screen.queryByText(new RegExp(forbidden, 'i'))).not.toBeOnTheScreen();
      }
    });

    it('renders it in Spanish too', async () => {
      mockLanguage = 'es';
      mockStoreState = unreadable();

      await render(<AccountSettingsSection />);

      expect(screen.getByText('Tu plan está en espera')).toBeOnTheScreen();
    });

    it('leaves a normal ready dashboard untouched', async () => {
      mockStoreState = {
        status: 'ready',
        data: { ...baseData, wellness: 'available' },
        error: null,
        refresh,
        syncNow,
        loadSampleData,
      };

      await render(<AccountSettingsSection />);

      expect(screen.queryByText('Your plan is on hold')).not.toBeOnTheScreen();
    });
  });

  describe('conflict review entry (ADR-P030 C-6)', () => {
    function withConflicts(conflicts: number): DashboardState {
      return {
        status: 'ready',
        data: { ...baseData, sync: { ...baseData.sync, conflicts } },
        error: null,
        refresh,
        syncNow,
        loadSampleData,
      };
    }

    it('offers no entry while nothing needs a decision', async () => {
      mockStoreState = withConflicts(0);

      await render(<AccountSettingsSection />);

      expect(screen.queryByTestId('dashboard-sync-conflicts')).not.toBeOnTheScreen();
    });

    it('shows an explicit labelled button once conflicts are outstanding', async () => {
      mockStoreState = withConflicts(2);

      await render(<AccountSettingsSection />);

      expect(screen.getByTestId('dashboard-sync-conflicts')).toBeOnTheScreen();
      expect(screen.getByText('Review changes')).toBeOnTheScreen();
      expect(screen.getByLabelText('Review changes that need your decision')).toBeOnTheScreen();
    });

    it('meets the 44x44 minimum target', async () => {
      mockStoreState = withConflicts(1);

      await render(<AccountSettingsSection />);

      const flat = (StyleSheet.flatten(
        screen.getByTestId('dashboard-sync-conflicts').props.style,
      ) ?? {}) as ViewStyle;
      expect(flat.minHeight).toBeGreaterThanOrEqual(44);
      expect(flat.minWidth).toBeGreaterThanOrEqual(44);
    });

    it('pushes the review route, one level from the hub', async () => {
      mockStoreState = withConflicts(1);

      const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');

      await render(<AccountSettingsSection />);
      await fireEvent.press(screen.getByTestId('dashboard-sync-conflicts'));

      expect(router.push).toHaveBeenCalledWith('/sync-conflicts');
    });

    it('leaves the sync banner itself report-only — it is not navigation', async () => {
      mockStoreState = withConflicts(3);

      await render(<AccountSettingsSection />);

      const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');

      // The banner reports; the button navigates. Pressing the banner's own
      // text must reach no router at all (ADR-P030 §Decision 1).
      await fireEvent.press(screen.getByText('Conflicts pending'));

      expect(router.push).not.toHaveBeenCalled();
    });

    it('labels the entry in Spanish too', async () => {
      mockLanguage = 'es';
      mockStoreState = withConflicts(1);

      await render(<AccountSettingsSection />);

      expect(screen.getByText('Revisar cambios')).toBeOnTheScreen();
    });
  });
});

describe('S-4 read-only access in Cuenta y ajustes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    configureEntitlementEnforcement(true);
    beginEntitlementCheck('user-1');
    setEntitlementAccess('user-1', false);
  });

  afterEach(async () => {
    // Restore the default disabled projection through the production API,
    // inside act: the still-mounted screen re-renders on the publication.
    await act(async () => {
      configureEntitlementEnforcement(false);
    });
  });

  it('explains read-only access and keeps syncing usable', async () => {
    setStore({ status: 'ready', data: baseData });
    await render(<AccountSettingsSection />);

    expect(screen.getByTestId('subscription-access-notice')).toBeOnTheScreen();
    expect(screen.getByTestId('dashboard-sync-now').props.accessibilityState).not.toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});
