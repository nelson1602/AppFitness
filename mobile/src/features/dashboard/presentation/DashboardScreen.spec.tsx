import { render, screen, waitFor } from '@testing-library/react-native';

import type { DashboardState } from '../domain/dashboard.types';
import type { HomeSummary } from '../domain/home-summary';
import { DashboardScreen } from './DashboardScreen';

const mockRefresh = jest.fn();
const mockLoadHomeData = jest.fn();
let mockStatus: DashboardState['status'] = 'ready';
let mockLanguage: 'en' | 'es' = 'en';

const SUMMARY: HomeSummary = {
  week: { done: 1, goal: 4, complete: false },
  weight: { current: 81.7, start: 84, target: 78, progress: 0.4 },
  today: { kind: 'rest', active: false },
  coach: 'rest',
  calories: { consumed: 400, target: 2776, share: 0.14 },
};

jest.mock('../application/dashboard.store', () => ({
  useDashboardStore: (select: (state: Pick<DashboardState, 'status' | 'refresh'>) => unknown) =>
    select({ status: mockStatus, refresh: mockRefresh }),
}));
jest.mock('../application/use-home-data', () => ({
  loadHomeData: () => mockLoadHomeData(),
  useHomeData: () => ({
    summary: SUMMARY,
    notifications: [],
    routine: null,
    weekdayIndex: 4,
    goalType: 'RECOMPOSITION',
    goalTargetDate: null,
    evaluationDate: '2026-09-01',
    evaluation: {
      bmi: 25.8,
      bmiCategory: 'OVERWEIGHT',
      macros: [
        { kind: 'protein', target: 163, consumed: 20 },
        { kind: 'carbs', target: 358, consumed: 50 },
        { kind: 'fat', target: 77, consumed: 10 },
      ],
    },
  }),
}));
// A faithful-enough double of expo-router's useFocusEffect: it runs the effect
// on registration and exposes the latest callback to simulate a refocus.
let latestFocusEffect: (() => void | (() => void)) | undefined;
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), navigate: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => {
      latestFocusEffect = effect;
      React.useEffect(() => effect(), [effect]);
    },
  };
});
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

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = 'ready';
  mockLanguage = 'en';
  latestFocusEffect = undefined;
});

describe('DashboardScreen (Inicio, ADR-P039)', () => {
  it("shows exactly the prototype's six blocks, in its order", async () => {
    mockLanguage = 'es';
    await render(<DashboardScreen />);

    const order = [
      'home-goal-card',
      'home-coach-card',
      'home-tile-training',
      'home-eval-card',
      'home-quick-food',
      'home-coming-soon',
    ];
    for (const id of order) expect(screen.getByTestId(id)).toBeOnTheScreen();
    const rendered = JSON.stringify(screen.toJSON());
    const positions = order.map((id) => rendered.indexOf(`"testID":"${id}"`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(screen.getByRole('header', { name: 'Tu meta te espera' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Tu evaluación de hoy' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Próximamente' })).toBeOnTheScreen();
  });

  it('carries nothing else: those moved to Perfil → Cuenta y ajustes', async () => {
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('onboarding-progress')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Synchronize local changes' })).toBeNull();
    expect(screen.queryByText('iCoach recommendations')).toBeNull();
    expect(screen.queryByText('Verify your email')).toBeNull();
    expect(screen.queryByTestId('subscription-access-notice')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign out of your account' })).toBeNull();
  });

  it('refreshes and loads its data on focus, and again on a refocus (BUG-019)', async () => {
    await render(<DashboardScreen />);
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockLoadHomeData).toHaveBeenCalledTimes(1);

    latestFocusEffect?.();

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(2));
    expect(mockLoadHomeData).toHaveBeenCalledTimes(2);
  });

  it('does not reload on an unrelated re-render', async () => {
    const view = await render(<DashboardScreen />);
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));

    view.rerender(<DashboardScreen />);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['en', "Dashboard isn't available on the web"],
    ['es', 'El panel no está disponible en la web'],
  ] as const)(
    'shows only the Web-unavailable state on Web (%s, ADR-P019)',
    async (language, title) => {
      mockLanguage = language;
      mockStatus = 'web-unavailable';
      await render(<DashboardScreen />);

      expect(screen.getByText(title)).toBeOnTheScreen();
      expect(screen.queryByTestId('home-goal-card')).toBeNull();
      expect(screen.queryByTestId('home-coach-card')).toBeNull();
    },
  );
});
