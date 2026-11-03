import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';

import { signOut } from '@/features/authentication';
import type { HomeSummary } from '@/features/dashboard/domain/home-summary';

import { ProfileTab } from './ProfileTab';
import { otherLanguageStrings } from '@/shared/localization/language-leak.testkit';

let mockLanguage: 'en' | 'es' = 'en';
const mockRefresh = jest.fn();
const mockLoadHomeData = jest.fn();
let mockHome: Record<string, unknown>;
const mockLoadPreferences = jest.fn();
let mockProfile: Record<string, unknown> | null;
let mockWellness: { affectedAreas: string[] } | null;
let mockPreferences: Record<string, unknown>[];

const SUMMARY: HomeSummary = {
  week: { done: 0, goal: 4, complete: false },
  weight: { current: 81.7, start: 84, target: 78, progress: 0.4 },
  today: { kind: 'rest', active: false },
  coach: 'rest',
  calories: { consumed: null, target: null, share: null },
};

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => effect(), [effect]);
  },
}));
jest.mock('@/features/authentication', () => ({ signOut: jest.fn() }));
jest.mock('@/features/dashboard/application/dashboard.store', () => ({
  useDashboardStore: (select: (state: { refresh: () => void }) => unknown) =>
    select({ refresh: mockRefresh }),
}));
jest.mock('@/features/dashboard/application/use-home-data', () => ({
  loadHomeData: () => mockLoadHomeData(),
  useHomeData: () => mockHome,
}));
jest.mock('../application/profile.store', () => ({
  useProfileStore: (select: (state: { profile: Record<string, unknown> | null }) => unknown) =>
    select({ profile: mockProfile }),
}));
jest.mock('@/features/wellness/application/wellness-safety-profile.store', () => ({
  useWellnessSafetyProfileStore: (
    select: (state: { profile: { affectedAreas: string[] } | null }) => unknown,
  ) => select({ profile: mockWellness }),
}));
jest.mock('@/features/nutrition/application/dietary-preference.store', () => {
  const useDietaryPreferenceStore = (
    select: (state: { preferences: Record<string, unknown>[] }) => unknown,
  ) => select({ preferences: mockPreferences });
  useDietaryPreferenceStore.getState = () => ({ load: mockLoadPreferences });
  return { useDietaryPreferenceStore };
});
// "Cuenta y ajustes" has its own spec (AccountSettingsSection.spec.tsx).
jest.mock('@/features/dashboard/presentation/AccountSettingsSection', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return { AccountSettingsSection: () => <RN.Text testID="account-settings">settings</RN.Text> };
});
jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...actual,
    // The selector has its own spec; here it only has to be present.
    LanguageSelector: () => <RN.Text testID="language-selector">language</RN.Text>,
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
  mockProfile = {
    heightCm: 178,
    activityLevel: 'MODERATE',
    stressLevelBaseline: 3,
    trainingDaysPerWeek: 4,
  };
  mockWellness = { affectedAreas: ['knee', 'lower_back'] };
  mockPreferences = [
    {
      id: 'dp-1',
      exclusionType: 'catalog_key',
      avoidTag: null,
      catalogKey: 'food.shrimp',
      kind: 'allergy',
    },
  ];
  mockHome = {
    summary: SUMMARY,
    currentWeightKg: 81.7,
    evaluation: { bmi: 25.8, bmiCategory: 'OVERWEIGHT', macros: [] },
    evaluationDate: '2026-09-01',
    goalType: 'RECOMPOSITION',
    goalTargetDate: '2026-12-31',
  };
});

describe('ProfileTab (ADR-P039)', () => {
  it("shows the prototype's panels with the account's data, in Spanish", async () => {
    mockLanguage = 'es';
    await render(<ProfileTab />);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockLoadHomeData).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: 'Evaluación física' })).toBeOnTheScreen();
    expect(screen.getByText('1 sept')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-evaluation')).toHaveTextContent(
      /Peso81,7\skg.*Estatura178\scm.*IMC25,8/,
    );
    expect(screen.getByRole('header', { name: 'Meta' })).toBeOnTheScreen();
    expect(screen.getByText('Recomposición (perder grasa y ganar músculo)')).toBeOnTheScreen();
    expect(
      screen.getByText('78 kg para el 31 de diciembre de 2026 · 4 entrenamientos por semana'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Próximamente' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Cuenta y ajustes' })).toBeOnTheScreen();
    expect(screen.getByTestId('account-settings')).toBeOnTheScreen();
    expect(screen.getByTestId('language-selector')).toBeOnTheScreen();
  });

  it("summarises the evaluation as the prototype's Salud, Alimentación and Estilo de vida chips (v8.1 round 2)", async () => {
    mockLanguage = 'es';
    await render(<ProfileTab />);

    expect(mockLoadPreferences).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('profile-summary-health')).toHaveTextContent(
      /^Salud:\s*Rodilla\s*Espalda baja$/,
    );
    expect(screen.getByTestId('profile-summary-food')).toHaveTextContent(
      /^Alimentación:\s*Camarones$/,
    );
    expect(screen.getByTestId('profile-summary-lifestyle')).toHaveTextContent(
      /^Estilo de vida:\s*Actividad moderada\s*Estrés medio$/,
    );
    // Injuries and foods to avoid in the energy tone, lifestyle neutral.
    const border = (testID: string) =>
      StyleSheet.flatten(screen.getByTestId(testID).props.style as ViewStyle).borderColor;
    expect(border('profile-summary-health-chip-0')).toBe(border('profile-summary-food-chip-0'));
    expect(border('profile-summary-health-chip-0')).not.toBe(
      border('profile-summary-lifestyle-chip-0'),
    );
  });

  it('says "Sin lesiones" and "Sin alergias ni restricciones" in the success tone when nothing is marked', async () => {
    mockLanguage = 'es';
    mockWellness = null;
    mockPreferences = [];
    await render(<ProfileTab />);

    expect(screen.getByTestId('profile-summary-health')).toHaveTextContent(
      /^Salud:\s*Sin lesiones$/,
    );
    expect(screen.getByTestId('profile-summary-food')).toHaveTextContent(
      /^Alimentación:\s*Sin alergias ni restricciones$/,
    );
  });

  it('writes the summary and the weekly workouts in English, with the singular for one day', async () => {
    mockProfile = { ...mockProfile, trainingDaysPerWeek: 1 };
    await render(<ProfileTab />);

    expect(screen.getByTestId('profile-summary-lifestyle')).toHaveTextContent(
      /^Lifestyle:\s*moderate activity\s*medium stress$/,
    );
    expect(screen.getByTestId('profile-goal-detail')).toHaveTextContent(
      /^78\skg by December 31, 2026 · 1 workout a week$/,
    );
  });

  it('leaves the weekly workouts and the lifestyle row out when they were never answered', async () => {
    mockProfile = { heightCm: 178 };
    await render(<ProfileTab />);

    expect(screen.getByTestId('profile-goal-detail')).toHaveTextContent(
      /^78\skg by December 31, 2026$/,
    );
    expect(screen.queryByTestId('profile-summary-lifestyle')).toBeNull();
  });

  it('shows no Seguridad panel or biometric switch: the app has no biometric lock to wire it to', async () => {
    mockLanguage = 'es';
    await render(<ProfileTab />);

    expect(screen.queryByRole('header', { name: 'Seguridad' })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/Face ID|Huella/)).toBeNull();
  });

  it.each([
    ['profile-wellness-safety', '/evaluation?mode=update'],
    ['profile-goal', '/goal-edit'],
    ['profile-edit', '/profile-edit'],
    ['profile-subscription', '/subscription'],
    ['profile-delete-account', '/delete-account'],
  ] as const)('%s opens %s (never acts directly)', async (testID, href) => {
    await render(<ProfileTab />);
    await fireEvent.press(screen.getByTestId(testID));
    expect(push()).toHaveBeenCalledWith(href);
  });

  it('lets the "Próximamente" chip wrap below the title instead of breaking the word (v8 Block 4)', async () => {
    mockLanguage = 'es';
    await render(<ProfileTab />);

    const row = StyleSheet.flatten(
      screen.getByTestId('profile-soon-title-row').props.style as ViewStyle,
    );
    expect(row).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(screen.getByText('Próximamente')).toBeOnTheScreen();
  });

  it('offers sign-out that clears the session (the route guard handles the redirect)', async () => {
    await render(<ProfileTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out of your account' }));

    expect(jest.mocked(signOut)).toHaveBeenCalledTimes(1);
    expect(push()).not.toHaveBeenCalled();
  });

  it('shows the empty states before there is a weight, a goal or an assessment', async () => {
    mockHome = {
      summary: { ...SUMMARY, weight: null },
      currentWeightKg: null,
      evaluation: null,
      evaluationDate: null,
      goalType: null,
      goalTargetDate: null,
    };
    await render(<ProfileTab />);

    expect(screen.getByTestId('profile-evaluation')).toHaveTextContent(/Weight–.*BMI–/);
    expect(screen.getByText('Set a goal so the iCoach can plan for it.')).toBeOnTheScreen();
  });

  it('does not expose dormant medical fields or actions (ADR-P038)', async () => {
    mockLanguage = 'es';
    await render(<ProfileTab />);

    expect(screen.queryByText(/Presión/)).toBeNull();
    expect(screen.queryByText(/Pulso/)).toBeNull();
    // Owner rule (v8): Salud names injuries only, never medical conditions.
    expect(screen.queryByText(/condici/i)).toBeNull();
    expect(screen.queryByText('Record evaluation')).toBeNull();
  });
});

// v8.1 guard: no string of the other language on this screen, in either language.
describe('ProfileTab language guard (v8.1)', () => {
  it.each(['en', 'es'] as const)(
    'renders no copy of the other language in %s',
    async (language) => {
      mockLanguage = language;
      await render(<ProfileTab />);
      expect(otherLanguageStrings(screen.root, language)).toEqual([]);
    },
  );
});
