import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { HomeSummary } from '@/features/dashboard/domain/home-summary';

import { WELCOME_AUTO_CONTINUE_MS, WelcomeScreen } from './WelcomeScreen';

let mockLanguage: 'en' | 'es' = 'en';
let mockReduceMotion = false;
let mockScreenReader = false;
const mockMarkSeen = jest.fn();
const mockLoadHomeData = jest.fn();

const SUMMARY: HomeSummary = {
  week: { done: 1, goal: 3, complete: false },
  weight: null,
  today: { kind: 'training', minutes: 40, completed: false },
  coach: 'start',
  calories: { consumed: null, target: null, share: null },
};

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: 'authenticated', session: { user: { username: 'Nelson' } } }),
}));
jest.mock('@/features/dashboard/application/use-home-data', () => ({
  loadHomeData: () => mockLoadHomeData(),
  useHomeData: () => ({ summary: SUMMARY, notifications: [] }),
}));
jest.mock('../application/welcome-gate', () => ({ markWelcomeSeen: () => mockMarkSeen() }));
jest.mock('@/shared/presentation', () => ({
  ...jest.requireActual('@/shared/presentation'),
  useReducedMotion: () => mockReduceMotion,
  useScreenReader: () => mockScreenReader,
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

function replace() {
  return jest.requireMock<{ router: { replace: jest.Mock } }>('expo-router').router.replace;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockLanguage = 'en';
  mockReduceMotion = false;
  mockScreenReader = false;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('WelcomeScreen (ADR-P039 D5)', () => {
  it('marks the welcome seen and loads the data it shows', async () => {
    await render(<WelcomeScreen />);

    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
    expect(mockLoadHomeData).toHaveBeenCalledTimes(1);
  });

  it("greets the person with the week's goal and today's plan, in Spanish", async () => {
    mockLanguage = 'es';
    await render(<WelcomeScreen />);

    expect(screen.getByRole('header', { name: '¡Hola, Nelson!' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Tu meta te espera' })).toBeOnTheScreen();
    expect(screen.getByLabelText('1 de 3 entrenamientos esta semana')).toBeOnTheScreen();
    expect(screen.getByTestId('welcome-today')).toHaveTextContent('Hoy: cuerpo completo · 40 min');
  });

  it.each(['welcome-continue', 'welcome-skip'])('%s goes to Inicio', async (testID) => {
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByTestId(testID));

    expect(replace()).toHaveBeenCalledWith('/dashboard');
  });

  it('continues by itself after five seconds', async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByTestId('welcome-auto')).toBeOnTheScreen();

    await act(async () => jest.advanceTimersByTime(WELCOME_AUTO_CONTINUE_MS - 1));
    expect(replace()).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(replace()).toHaveBeenCalledWith('/dashboard');
  });

  it('waits while paused and restarts the full delay on resume', async () => {
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await act(async () => jest.advanceTimersByTime(WELCOME_AUTO_CONTINUE_MS * 2));
    expect(replace()).not.toHaveBeenCalled();
    expect(screen.queryByTestId('welcome-auto')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    await act(async () => jest.advanceTimersByTime(WELCOME_AUTO_CONTINUE_MS));
    expect(replace()).toHaveBeenCalledWith('/dashboard');
  });

  it.each([
    [
      'reduced motion',
      (): void => {
        mockReduceMotion = true;
      },
    ],
    [
      'a screen reader',
      (): void => {
        mockScreenReader = true;
      },
    ],
  ] as const)('never continues by itself under %s', async (_name, arrange) => {
    arrange();
    await render(<WelcomeScreen />);
    await act(async () => jest.advanceTimersByTime(WELCOME_AUTO_CONTINUE_MS * 3));

    expect(replace()).not.toHaveBeenCalled();
    expect(screen.queryByTestId('welcome-auto')).toBeNull();
    expect(screen.queryByTestId('welcome-pause')).toBeNull();
    expect(screen.getByTestId('welcome-continue')).toBeOnTheScreen();
  });
});
