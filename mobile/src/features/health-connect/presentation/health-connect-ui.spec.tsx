import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useHealthConnectStore } from '../application/health-connect.store';
import { HealthConnectRationaleScreen } from './HealthConnectRationaleScreen';
import { HealthConnectSettings } from './HealthConnectSettings';
import { WatchCard } from './WatchCard';

let mockLanguage: 'en' | 'es' = 'es';
let mockStatus: string | null = 'connected';
let mockSession = 'authenticated';
const mockConnect = jest.fn();
const mockSetWaterGoal = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockSession }),
  getSession: () => ({ user: { id: 'u1' } }),
}));
jest.mock('../application/use-watch-status', () => ({
  ...jest.requireActual('../application/use-watch-status'),
  useWatchStatus: () => mockStatus,
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

const fallback = <Text testID="coming-soon">Próximamente</Text>;

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'es';
  mockStatus = 'connected';
  mockSession = 'authenticated';
  mockConnect.mockImplementation(() => {
    mockStatus = 'not-connected';
    return Promise.resolve();
  });
  useHealthConnectStore.setState({
    userId: 'u1',
    status: 'connected',
    granted: ['ActiveCaloriesBurned', 'ExerciseSession', 'Hydration', 'Steps'],
    totals: { steps: 6450, activeKcal: 312.4, hydrationMl: 1250 },
    waterGoalMl: null,
    connect: mockConnect,
    setWaterGoal: mockSetWaterGoal,
  });
});

describe('Inicio watch card (ADR-P048)', () => {
  it.each([['off'], ['unavailable'], [null]])(
    'shows the old "Próximamente" card when the status is %s',
    async (status) => {
      mockStatus = status;
      await render(<WatchCard fallback={fallback} />);
      expect(screen.getByTestId('coming-soon')).toBeOnTheScreen();
      expect(screen.queryByTestId('home-watch')).toBeNull();
    },
  );

  it('without a water goal: only what the watch recorded, neutral', async () => {
    await render(<WatchCard fallback={fallback} />);
    expect(screen.getByTestId('home-watch-water-line')).toHaveTextContent(
      'Tu reloj registró 1250 ml hoy',
    );
    expect(screen.queryByTestId('home-watch-water-progress')).toBeNull();
    expect(screen.getByTestId('home-watch-activity-line')).toHaveTextContent(
      '6450 pasos · 312 kcal activas',
    );
  });

  it('with the person’s goal: "Tu reloj registró X ml; tu meta es Y" and a progress bar', async () => {
    useHealthConnectStore.setState({ waterGoalMl: 2500 });
    await render(<WatchCard fallback={fallback} />);
    expect(screen.getByTestId('home-watch-water-line')).toHaveTextContent(
      'Tu reloj registró 1250 ml; tu meta es 2500 ml',
    );
    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityValue', {
      min: 0,
      max: 100,
      now: 50,
    });
  });

  it('a type not shared in Health Connect says so instead of showing 0', async () => {
    useHealthConnectStore.setState({ granted: ['Steps'] });
    await render(<WatchCard fallback={fallback} />);
    expect(screen.getByTestId('home-watch-water')).toHaveTextContent(
      /No compartido en Health Connect/,
    );
    expect(screen.getByTestId('home-watch-activity-line')).toHaveTextContent('6450 pasos');
  });

  it('not connected: an invitation that opens the rationale screen', async () => {
    mockStatus = 'not-connected';
    await render(<WatchCard fallback={fallback} />);
    await fireEvent.press(screen.getByTestId('home-watch-connect'));
    expect(jest.requireMock('expo-router').router.push).toHaveBeenCalledWith('/health-connect');
  });

  it('uses no medical or prescriptive wording', async () => {
    useHealthConnectStore.setState({ waterGoalMl: 2500 });
    await render(<WatchCard fallback={fallback} />);
    const text = JSON.stringify(screen.toJSON());
    expect(text).not.toMatch(/deberías|debes|recomend|médic|deshidrat|should|must|recommend/i);
  });
});

describe('Health Connect rationale screen (ADR-P048)', () => {
  it('explains each of the four types and links the privacy policy', async () => {
    mockStatus = 'not-connected';
    await render(<HealthConnectRationaleScreen />);
    for (const title of ['Pasos', 'Calorías activas', 'Sesiones de ejercicio', 'Hidratación']) {
      expect(screen.getByText(title)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('health-connect-privacy')).toBeOnTheScreen();
    expect(screen.getByText(/no se envían a nuestros servidores/)).toBeOnTheScreen();
  });

  it('denied path: after asking, nothing shared, the app works the same', async () => {
    mockStatus = 'not-connected';
    await render(<HealthConnectRationaleScreen />);
    await fireEvent.press(screen.getByTestId('health-connect-continue'));
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('health-connect-denied')).toHaveTextContent(
      /No se compartió ningún dato. La app funciona igual/,
    );
  });

  it('no Health Connect on the phone: says so, offers no connect button', async () => {
    mockStatus = 'unavailable';
    await render(<HealthConnectRationaleScreen />);
    expect(screen.getByTestId('health-connect-unavailable')).toBeOnTheScreen();
    expect(screen.queryByTestId('health-connect-continue')).toBeNull();
  });

  it('opened by Health Connect while signed out: still shows the explanation and policy', async () => {
    mockStatus = null;
    mockSession = 'unauthenticated';
    await render(<HealthConnectRationaleScreen />);
    expect(screen.getByText('Hidratación')).toBeOnTheScreen();
    expect(screen.getByTestId('health-connect-privacy')).toBeOnTheScreen();
    expect(screen.queryByTestId('health-connect-continue')).toBeNull();
  });
});

describe('Perfil water goal (ADR-P048)', () => {
  it('saves a goal the person types; rejects one out of range', async () => {
    await render(<HealthConnectSettings status="connected" />);
    await fireEvent.changeText(screen.getByTestId('profile-water-goal-input'), '9000');
    await fireEvent.press(screen.getByTestId('profile-water-goal-save'));
    expect(mockSetWaterGoal).not.toHaveBeenCalled();
    expect(screen.getByTestId('profile-water-goal-message')).toHaveTextContent(
      'Escribe un número entero entre 250 y 6000.',
    );
    await fireEvent.changeText(screen.getByTestId('profile-water-goal-input'), '2.500');
    await fireEvent.press(screen.getByTestId('profile-water-goal-save'));
    expect(mockSetWaterGoal).toHaveBeenCalledWith(2500);
  });

  it('has no default goal and no goal field until connected', async () => {
    await render(<HealthConnectSettings status="connected" />);
    expect(screen.getByTestId('profile-water-goal-input')).toHaveProp('value', '');
    await render(<HealthConnectSettings status="not-connected" />);
    expect(screen.queryByTestId('profile-water-goal')).toBeNull();
  });
});
