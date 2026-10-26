import { fireEvent, render, screen } from '@testing-library/react-native';

import type { HomeSummary } from '@/features/dashboard/domain/home-summary';

import { ProgressTab } from './ProgressTab';

let mockLanguage: 'en' | 'es' = 'en';
let mockStatus = 'ready';
let mockHome: { summary: HomeSummary; currentWeightKg: number | null };
const mockLoadHomeData = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => effect(), [effect]);
  },
}));
jest.mock('../application/progress.store', () => ({
  useProgressStore: (select: (state: { status: string }) => unknown) =>
    select({ status: mockStatus }),
}));
jest.mock('@/features/dashboard/application/use-home-data', () => ({
  loadHomeData: () => mockLoadHomeData(),
  useHomeData: () => mockHome,
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

const SUMMARY: HomeSummary = {
  week: { done: 2, goal: 3, complete: false },
  weight: { current: 81.7, start: 84, target: 78, progress: 0.4 },
  today: { kind: 'rest', active: false },
  coach: 'rest',
  calories: { consumed: null, target: null, share: null },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockStatus = 'ready';
  mockHome = { summary: SUMMARY, currentWeightKg: 81.7 };
});

describe('ProgressTab (ADR-P039)', () => {
  it('shows the weight toward the goal and this week, in Spanish', async () => {
    mockLanguage = 'es';
    await render(<ProgressTab />);

    expect(mockLoadHomeData).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('progress-current-weight')).toHaveTextContent('81,7 kg');
    expect(screen.getByText('Meta 78 kg')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-week-card')).toHaveTextContent(
      'Resumen de la semanaEntrenamientos2/3',
    );
  });

  // Regression (emulator run 2026-10-25): a weight without a target weight
  // was reported as no weight at all.
  it('shows the latest weight even without a target, and asks for the target', async () => {
    mockHome = { summary: { ...SUMMARY, weight: null }, currentWeightKg: 83 };
    await render(<ProgressTab />);

    expect(screen.getByTestId('progress-current-weight')).toHaveTextContent('83 kg');
    expect(screen.getByText('Set a target weight to track it here.')).toBeOnTheScreen();
    expect(screen.queryByText('Log your weight to see your progress here.')).toBeNull();
  });

  it('asks for a first weight when there is none', async () => {
    mockHome = { summary: { ...SUMMARY, weight: null }, currentWeightKg: null };
    await render(<ProgressTab />);

    expect(screen.queryByTestId('progress-current-weight')).toBeNull();
    expect(screen.getByText('Log your weight to see your progress here.')).toBeOnTheScreen();
  });

  it('opens the full progress screen', async () => {
    await render(<ProgressTab />);
    await fireEvent.press(screen.getByTestId('progress-open-log'));
    expect(
      jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router.push,
    ).toHaveBeenCalledWith('/progress-log');
  });

  it('renders the honest Web state (ADR-P019)', async () => {
    mockStatus = 'web-unavailable';
    await render(<ProgressTab />);
    expect(screen.queryByTestId('progress-weight-card')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
