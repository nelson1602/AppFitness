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

  it('keeps the watch title and says the data comes via Health Connect', async () => {
    await render(<WatchCard fallback={fallback} />);
    expect(screen.getByText('Tu reloj')).toBeOnTheScreen();
    expect(screen.getByTestId('home-watch-subtitle')).toHaveTextContent(
      'Reloj y teléfono vía Health Connect',
    );
  });

  it('without a water goal: only what was logged, neutral, no device claim', async () => {
    await render(<WatchCard fallback={fallback} />);
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/registró/);
    expect(screen.getByTestId('home-watch-water-line')).toHaveTextContent(
      'Registrado hoy: 1250 ml',
    );
    expect(screen.getByTestId('home-watch-water-line')).not.toHaveTextContent(
      'Tu reloj registró 1250 ml hoy',
    );
    expect(screen.queryByTestId('home-watch-water-progress')).toBeNull();
    expect(screen.getByTestId('home-watch-activity-line')).toHaveTextContent(
      '6450 pasos · 312 kcal activas',
    );
  });

  it('with the person’s goal: "Registrado hoy: X ml de Y ml" and a water ring', async () => {
    useHealthConnectStore.setState({ waterGoalMl: 2500 });
    await render(<WatchCard fallback={fallback} />);
    expect(screen.getByTestId('home-watch-water-line')).toHaveTextContent(
      'Registrado hoy: 1250 ml de 2500 ml',
    );
    expect(screen.getByTestId('home-watch-water-progress')).toHaveProp(
      'accessibilityLabel',
      'Agua de hoy hacia tu meta',
    );
    expect(screen.getByTestId('home-watch-water-line')).not.toHaveTextContent(
      'Tu reloj registró 1250 ml; tu meta es 2500 ml',
    );
    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityValue', {
      min: 0,
      max: 100,
      now: 50,
    });
  });

  it('English: same structure and wording', async () => {
    mockLanguage = 'en';
    useHealthConnectStore.setState({ waterGoalMl: 2500 });
    await render(<WatchCard fallback={fallback} />);
    expect(screen.getByText('Your watch')).toBeOnTheScreen();
    expect(screen.getByTestId('home-watch-subtitle')).toHaveTextContent(
      'Watch and phone via Health Connect',
    );
    expect(screen.getByTestId('home-watch-water-line')).toHaveTextContent(
      'Logged today: 1,250 ml of 2,500 ml',
    );
    expect(screen.getByTestId('home-watch-footer')).toHaveTextContent(
      'Train with your watch and the iCoach subtracts those sessions from the extra cardio.',
    );
  });

  it('footer: only when exercise sessions are shared', async () => {
    await render(<WatchCard fallback={fallback} />);
    expect(screen.getByTestId('home-watch-footer')).toHaveTextContent(
      'Entrena con tu reloj y el iCoach descuenta esas sesiones del cardio extra.',
    );
    useHealthConnectStore.setState({ granted: ['Steps', 'Hydration'] });
    await render(<WatchCard fallback={fallback} />);
    expect(screen.queryByTestId('home-watch-footer')).toBeNull();
  });

  it.each([
    ['no totals read yet', null],
    ['all zero today', { steps: 0, activeKcal: 0, hydrationMl: 0 }],
  ])('connected with %s: the empty state, no zero lines', async (_label, totals) => {
    useHealthConnectStore.setState({ totals });
    await render(<WatchCard fallback={fallback} />);
    expect(screen.getByTestId('home-watch-empty')).toHaveTextContent(
      'Conecta tu reloj a Health Connect para ver aquí tu actividad.',
    );
    expect(screen.queryByTestId('home-watch-water')).toBeNull();
    expect(screen.queryByTestId('home-watch-activity')).toBeNull();
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

  it('shows the same "via Health Connect" subtitle as Inicio', async () => {
    await render(<HealthConnectSettings status="not-connected" />);
    expect(screen.getByTestId('profile-watch-subtitle')).toHaveTextContent(
      'Reloj y teléfono vía Health Connect',
    );
  });

  it('has no default goal and no goal field until connected', async () => {
    await render(<HealthConnectSettings status="connected" />);
    expect(screen.getByTestId('profile-water-goal-input')).toHaveProp('value', '');
    await render(<HealthConnectSettings status="not-connected" />);
    expect(screen.queryByTestId('profile-water-goal')).toBeNull();
  });
});

describe('Perfil data source (ADR-P048 amendment)', () => {
  const mockSetSource = jest.fn(() => Promise.resolve());
  beforeEach(() => {
    useHealthConnectStore.setState({
      sources: [
        { packageName: 'com.hihonor.health', isWatch: false, steps: 156 },
        { packageName: 'com.sec.android.app.shealth', isWatch: true, steps: 1117 },
      ],
      source: 'com.sec.android.app.shealth',
      pickedSource: null,
      setSource: mockSetSource,
    });
  });

  it('shows the source in use and the apps found, automatic selected', async () => {
    await render(<HealthConnectSettings status="connected" />);
    expect(screen.getByTestId('profile-health-source-current')).toHaveTextContent(
      'Fuente de datos: Samsung Health',
    );
    expect(screen.getByTestId('profile-health-source-com.hihonor.health')).toHaveTextContent(
      'Honor Salud',
    );
    expect(screen.getByTestId('profile-health-source-auto')).toHaveProp('accessibilityState', {
      disabled: false,
      selected: true,
    });
  });

  it('English labels', async () => {
    mockLanguage = 'en';
    await render(<HealthConnectSettings status="connected" />);
    expect(screen.getByTestId('profile-health-source-current')).toHaveTextContent(
      'Data source: Samsung Health',
    );
    expect(screen.getByTestId('profile-health-source-com.hihonor.health')).toHaveTextContent(
      'Honor Health',
    );
  });

  it('picking an app saves it; "Automática" clears the pick', async () => {
    await render(<HealthConnectSettings status="connected" />);
    await fireEvent.press(screen.getByTestId('profile-health-source-com.hihonor.health'));
    expect(mockSetSource).toHaveBeenLastCalledWith('com.hihonor.health');
    await fireEvent.press(screen.getByTestId('profile-health-source-auto'));
    expect(mockSetSource).toHaveBeenLastCalledWith(null);
  });

  it('an unknown app is "Otra app", never its package name; a pick with no data stays listed', async () => {
    useHealthConnectStore.setState({
      sources: [{ packageName: 'com.example.tracker', isWatch: false, steps: 10 }],
      source: 'com.garmin.android.apps.connectmobile',
      pickedSource: 'com.garmin.android.apps.connectmobile',
    });
    await render(<HealthConnectSettings status="connected" />);
    expect(screen.getByTestId('profile-health-source-com.example.tracker')).toHaveTextContent(
      'Otra app',
    );
    expect(screen.queryByText(/com\./)).toBeNull();
    expect(
      screen.getByTestId('profile-health-source-com.garmin.android.apps.connectmobile'),
    ).toHaveProp('accessibilityState', { disabled: false, selected: true });
  });

  it('Honor phone + Galaxy Watch: "Este teléfono", never the raw origin, and chips that shrink', async () => {
    const HC_PHONE = 'com.android.healthconnect.phone.j1fb8597d7183337c986884aabc17d2d3';
    useHealthConnectStore.setState({
      sources: [
        { packageName: HC_PHONE, isWatch: false, steps: 156 },
        { packageName: 'com.sec.android.app.shealth', isWatch: true, steps: null },
      ],
      source: HC_PHONE,
      pickedSource: null,
    });
    await render(<HealthConnectSettings status="connected" />);
    expect(screen.getByTestId('profile-health-source-current')).toHaveTextContent(
      'Fuente de datos: Este teléfono',
    );
    const chip = screen.getByTestId(`profile-health-source-${HC_PHONE}`);
    expect(chip).toHaveTextContent('Este teléfono');
    expect(chip).toHaveStyle({ flexShrink: 1, maxWidth: '100%' });
    expect(
      screen.getByTestId('profile-health-source-com.sec.android.app.shealth'),
    ).toHaveTextContent('Samsung Health');
    expect(screen.queryByText(/healthconnect|j1fb8597/)).toBeNull();
  });

  it('hidden when nothing was found and nothing picked, and when not connected', async () => {
    useHealthConnectStore.setState({ sources: [], source: null, pickedSource: null });
    await render(<HealthConnectSettings status="connected" />);
    expect(screen.queryByTestId('profile-health-source')).toBeNull();
    useHealthConnectStore.setState({ source: 'com.sec.android.app.shealth' });
    await render(<HealthConnectSettings status="not-connected" />);
    expect(screen.queryByTestId('profile-health-source')).toBeNull();
  });
});
