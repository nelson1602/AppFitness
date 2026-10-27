import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useEvaluationStore } from '../application/evaluation.store';
import { draftFromSources } from '../domain/evaluation';
import { BUILD_HOLD_MS, BUILD_STEP_MS, PlanBuildingScreen } from './PlanBuildingScreen';

const mockLoad = jest.fn();
let mockPlan: Record<string, unknown> = {};
let mockReduceMotion = false;

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/features/authentication', () => ({ bindStoreToSession: jest.fn() }));
jest.mock('@/features/dashboard/application/use-home-data', () => ({ loadHomeData: jest.fn() }));
jest.mock('@/features/weekly-plan/application/weekly-plan.store', () => ({
  useWeeklyPlanStore: Object.assign(
    (select: (state: Record<string, unknown>) => unknown) => select(mockPlan),
    { getState: () => ({ load: mockLoad }) },
  ),
}));
jest.mock('@/shared/presentation', () => ({
  ...jest.requireActual('@/shared/presentation'),
  useReducedMotion: () => mockReduceMotion,
  Mascot: () => null,
  Pulse: () => null,
  GradientText: ({ children }: { children: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{children}</Text>;
  },
}));
jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  return {
    ...actual,
    useLocalization: () => ({ language: 'es', t: (key: string) => es[key] ?? key }),
  };
});

const readyPlan = {
  status: 'ready',
  current: {
    plan: {
      targets: { calories: 2150 },
      days: [
        { workout: { kind: 'TRAINING' } },
        { workout: { kind: 'RECOVERY' } },
        { workout: { kind: 'TRAINING' } },
        { workout: { kind: 'TRAINING' } },
      ],
    },
  },
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(router.replace).mockClear();
  mockLoad.mockClear();
  mockReduceMotion = false;
  const draft = draftFromSources({
    profile: null,
    goal: null,
    weightKg: null,
    wellness: null,
    preferences: [],
    today: '2026-10-28',
  });
  useEvaluationStore.setState({
    draft: { ...draft, foods: { egg: 'allergy' }, injuries: ['knee'] },
  });
});

afterEach(() => jest.useRealTimers());

describe('PlanBuildingScreen ("Creando tu plan personal")', () => {
  it('saves the first week and reads what the iCoach did, then welcomes the person', async () => {
    mockPlan = readyPlan;
    await render(<PlanBuildingScreen />);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Quitando de tu plan: huevo')).toBeTruthy();
    expect(screen.getByText('Adaptando tus ejercicios: rodilla')).toBeTruthy();
    expect(screen.getByText('Meta diaria: 2150 kcal')).toBeTruthy();
    expect(screen.getByText('Rutina de 3 entrenamientos por semana')).toBeTruthy();

    for (let i = 0; i < 5; i += 1) {
      await act(async () => jest.advanceTimersByTime(BUILD_STEP_MS));
    }
    expect(screen.getByTestId('building-step-4-done')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(BUILD_HOLD_MS));
    expect(router.replace).toHaveBeenCalledWith('/welcome');
  });

  it('never moves on before the plan exists', async () => {
    mockPlan = { status: 'loading', current: null };
    await render(<PlanBuildingScreen />);
    await act(async () => jest.advanceTimersByTime(10_000));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows everything at once under reduced motion', async () => {
    mockReduceMotion = true;
    mockPlan = readyPlan;
    await render(<PlanBuildingScreen />);
    expect(screen.getByTestId('building-step-4-done')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(0));
    expect(router.replace).toHaveBeenCalledWith('/welcome');
  });

  it('offers a retry and the evaluation when the plan cannot be built', async () => {
    mockPlan = { status: 'gap', current: null };
    await render(<PlanBuildingScreen />);
    expect(screen.getByTestId('building-error')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('building-retry'));
    expect(mockLoad).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByTestId('building-review'));
    expect(router.replace).toHaveBeenCalledWith('/evaluation');
  });
});
