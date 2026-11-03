import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { HomeSummary } from '@/features/dashboard/domain/home-summary';
import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';
import { useTheme } from '@/shared/theme';

import type { WeekActivity } from '../application/progress.gathering';
import type { BodyMeasurement, BodyWeight } from '../domain/progress';
import { ProgressTab } from './ProgressTab';
import { otherLanguageStrings } from '@/shared/localization/language-leak.testkit';

let mockLanguage: 'en' | 'es' = 'en';
let mockProgress: {
  status: string;
  error: string | null;
  bodyWeights: BodyWeight[];
  bodyMeasurements: BodyMeasurement[];
  weekActivity: WeekActivity | null;
};
let mockTarget: number | null;
let mockHome: { summary: HomeSummary; currentWeightKg: number | null };
const mockLoadHomeData = jest.fn();
const mockLoadWeekActivity = jest.fn(async (_weekStart: string) => undefined);
const mockAddBodyWeight = jest.fn(async (_input: unknown) => true);
const mockRecompute = jest.fn(async () => true);
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => effect(), [effect]);
  },
}));
jest.mock('../application/progress.store', () => {
  const state = () => ({
    ...mockProgress,
    loadWeekActivity: mockLoadWeekActivity,
    addBodyWeight: mockAddBodyWeight,
    recomputeSnapshots: mockRecompute,
  });
  const useProgressStore = (select: (s: ReturnType<typeof state>) => unknown) => select(state());
  useProgressStore.getState = state;
  return { useProgressStore };
});
jest.mock('@/features/profile/application/goal.store', () => ({
  useGoalStore: (select: (s: { goal: { targetWeightKg: number | null } }) => unknown) =>
    select({ goal: { targetWeightKg: mockTarget } }),
}));
jest.mock('@/shared/application/local-day', () => ({
  ...jest.requireActual('@/shared/application/local-day'),
  useLocalDay: (select: (s: { today: string }) => unknown) => select({ today: '2026-10-29' }),
}));
jest.mock('@/features/dashboard/application/use-home-data', () => ({
  loadHomeData: () => mockLoadHomeData(),
  useHomeData: () => mockHome,
}));
jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const english = jest.requireActual('@/shared/localization/resources/en').en;
  const spanish = jest.requireActual('@/shared/localization/resources/es').es;
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof english) => (mockLanguage === 'es' ? spanish[key] : english[key]),
    }),
  };
});

const SUMMARY: HomeSummary = {
  week: { done: 2, goal: 3, complete: false },
  weight: { current: 70.4, start: 72, target: 65, progress: 0.2 },
  today: { kind: 'rest', active: false },
  coach: 'rest',
  calories: { consumed: null, target: null, share: null },
};

function weight(date: string, weightKg: number): BodyWeight {
  return {
    id: `w-${date}`,
    date,
    weightKg,
    notes: null,
    version: 1,
    syncStatus: 'synced',
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
  };
}

function measurement(date: string, values: Partial<BodyMeasurement>): BodyMeasurement {
  return {
    id: `m-${date}`,
    date,
    bodyFatPct: null,
    muscleMassKg: null,
    waistCm: null,
    hipCm: null,
    chestCm: null,
    leftArmCm: null,
    rightArmCm: null,
    neckCm: null,
    notes: null,
    version: 1,
    syncStatus: 'synced',
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    ...values,
  };
}

const WEIGHTS = [weight('2026-10-29', 70.4), weight('2026-10-22', 71.2), weight('2026-10-15', 72)];
const MEASUREMENTS = [
  measurement('2026-10-29', {
    waistCm: 86,
    hipCm: 101,
    chestCm: 94,
    bodyFatPct: 31,
    muscleMassKg: 26.4,
  }),
  measurement('2026-09-30', {
    waistCm: 89,
    hipCm: 102,
    chestCm: 94,
    bodyFatPct: 33,
    muscleMassKg: 25.8,
  }),
];
const WEEK: WeekActivity = {
  weekStart: '2026-10-26',
  workouts: [
    { date: '2026-10-26', volumeKg: 2400 },
    { date: '2026-10-28', volumeKg: 2420 },
  ],
  calorieDays: [
    { date: '2026-10-26', calories: 1800 },
    { date: '2026-10-27', calories: 2000 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockProgress = {
    status: 'ready',
    error: null,
    bodyWeights: WEIGHTS,
    bodyMeasurements: MEASUREMENTS,
    weekActivity: WEEK,
  };
  mockTarget = 65;
  mockHome = { summary: SUMMARY, currentWeightKg: 70.4 };
});

/** The last `color` a node's flattened style sets. */
function colorOf(testID: string): string | undefined {
  const styles = [screen.getByTestId(testID).props.style].flat(3) as (
    { color?: string } | undefined
  )[];
  return styles.reduce<string | undefined>((found, style) => style?.color ?? found, undefined);
}

describe('ProgressTab (v8.1, approved prototype)', () => {
  it('renders Peso, Medidas, Resumen de la semana and Semanas anteriores in that order', async () => {
    mockLanguage = 'es';
    await render(<ProgressTab />);

    const headers = screen.getAllByRole('header').map((node) => node.props.children);
    expect(headers).toEqual(['Peso', 'Medidas', 'Resumen de la semana', 'Semanas anteriores']);
    expect(mockLoadHomeData).toHaveBeenCalledTimes(1);
    expect(mockLoadWeekActivity).toHaveBeenCalledWith('2026-10-26');
    // The separate log row is gone; the inline form and "Agregar medidas" replace it.
    expect(screen.queryByTestId('progress-open-log')).toBeNull();
    expect(screen.queryByText('Registrar peso y medidas')).toBeNull();
  });

  it('shows the weight chart against the target, with a summary that names it', async () => {
    mockLanguage = 'es';
    await render(<ProgressTab />);

    expect(screen.getByTestId('progress-current-weight')).toHaveTextContent('70,4 kg');
    expect(screen.getByTestId('weight-chart-target')).toBeOnTheScreen();
    expect(screen.getByLabelText('Peso: 70,4 kg, meta 65 kg, 3 registros')).toBeOnTheScreen();
  });

  it('draws no target line without a target, and asks for one', async () => {
    mockTarget = null;
    await render(<ProgressTab />);

    expect(screen.queryByTestId('weight-chart-target')).toBeNull();
    expect(screen.getByLabelText('Weight: 70.4 kg, 3 entries')).toBeOnTheScreen();
    expect(screen.getByText('Set a target weight to track it here.')).toBeOnTheScreen();
  });

  it('shows the empty states with no weight and no measurement', async () => {
    mockProgress = { ...mockProgress, bodyWeights: [], bodyMeasurements: [] };
    mockHome = { summary: { ...SUMMARY, weight: null }, currentWeightKg: null };
    await render(<ProgressTab />);

    expect(screen.queryByTestId('weight-chart')).toBeNull();
    expect(screen.queryByTestId('progress-current-weight')).toBeNull();
    expect(screen.getByText('Log your weight to see your progress here.')).toBeOnTheScreen();
    expect(screen.getByText('No measurements recorded yet.')).toBeOnTheScreen();
    expect(screen.queryByText('vs. 4 weeks ago')).toBeNull();
    // The form and the add tile stay available.
    expect(screen.getByTestId('progress-today-weight')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-add-measurements')).toBeOnTheScreen();
  });

  it("saves today's weight with a decimal comma through the progress store", async () => {
    mockLanguage = 'es';
    await render(<ProgressTab />);

    await fireEvent.changeText(screen.getByTestId('progress-today-weight'), '69,8');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar el peso de hoy' }));

    expect(mockAddBodyWeight).toHaveBeenCalledWith({
      date: '2026-10-29',
      weightKg: 69.8,
      notes: null,
    });
    expect(mockRecompute).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Peso guardado')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-today-weight').props.value).toBe('');
  });

  it.each([
    ['', 'Enter your weight in kg, for example 70.5'],
    ['abc', 'Enter your weight in kg, for example 70.5'],
    ['0', 'Enter a weight greater than 0'],
    ['1200', 'That value is too high'],
  ])('rejects %j without saving', async (typed, message) => {
    await render(<ProgressTab />);

    await fireEvent.changeText(screen.getByTestId('progress-today-weight'), typed);
    await fireEvent.press(screen.getByTestId('progress-today-weight-save'));

    expect(mockAddBodyWeight).not.toHaveBeenCalled();
    expect(screen.getByTestId('progress-today-weight-error')).toHaveTextContent(message);
  });

  it('keeps the typed weight and shows the save error when saving fails', async () => {
    mockAddBodyWeight.mockResolvedValueOnce(false);
    await render(<ProgressTab />);

    await fireEvent.changeText(screen.getByTestId('progress-today-weight'), '70.1');
    await fireEvent.press(screen.getByTestId('progress-today-weight-save'));
    mockProgress = { ...mockProgress, error: 'save failed' };
    await screen.rerender(<ProgressTab />);

    expect(mockRecompute).not.toHaveBeenCalled();
    expect(screen.getByText(en['progress.screen.saveErrorTitle'])).toBeOnTheScreen();
    expect(screen.queryByText('Weight saved')).toBeNull();
    expect(screen.getByTestId('progress-today-weight').props.value).toBe('70.1');
  });

  it('shows each measurement with its change against four weeks ago', async () => {
    mockLanguage = 'es';
    await render(<ProgressTab />);

    expect(screen.getByText('vs. hace 4 semanas')).toBeOnTheScreen();
    expect(screen.getByTestId('measurement-waistCm-value')).toHaveTextContent('86 cm');
    expect(screen.getByTestId('measurement-waistCm-delta')).toHaveTextContent('−3 cm');
    expect(screen.getByTestId('measurement-chestCm-delta')).toHaveTextContent('0 cm');
    expect(screen.getByTestId('measurement-bodyFatPct-value')).toHaveTextContent('31 %');
    expect(screen.getByTestId('measurement-muscleMassKg-delta')).toHaveTextContent('+0,6 kg');
    expect(screen.getByLabelText('Cintura: 86 cm. −3 cm vs. hace 4 semanas')).toBeOnTheScreen();
  });

  it('colours an improvement as success and no change as neutral', async () => {
    let colors: ReturnType<typeof useTheme>['colors'] | null = null;
    function Probe() {
      colors = useTheme().colors;
      return null;
    }
    await render(
      <>
        <Probe />
        <ProgressTab />
      </>,
    );
    expect(colors).not.toBeNull();
    const { success, onStageVariant } = colors as unknown as ReturnType<typeof useTheme>['colors'];
    expect(colorOf('measurement-waistCm-delta')).toBe(success);
    expect(colorOf('measurement-chestCm-delta')).toBe(onStageVariant);
  });

  it('reads "—" for a metric with no earlier measurement', async () => {
    mockProgress = {
      ...mockProgress,
      bodyMeasurements: [measurement('2026-10-29', { waistCm: 86 })],
    };
    await render(<ProgressTab />);

    expect(screen.getByTestId('measurement-waistCm-delta')).toHaveTextContent('—');
    expect(screen.getByTestId('measurement-hipCm-value')).toHaveTextContent('—');
    expect(
      screen.getByLabelText('Waist: 86 cm. No measurement from 4 weeks ago to compare'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Hips: not recorded')).toBeOnTheScreen();
  });

  it('opens the measurement log from "Agregar medidas"', async () => {
    await render(<ProgressTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add measurements' }));
    expect(mockPush).toHaveBeenCalledWith('/progress-log');
  });

  it('summarizes the week: workouts, volume and average kcal', async () => {
    mockLanguage = 'es';
    await render(<ProgressTab />);

    const week = within(screen.getByTestId('progress-week-card'));
    expect(week.getByTestId('progress-week-workouts')).toHaveTextContent('2/3Entrenamientos');
    expect(week.getByTestId('progress-week-volume')).toHaveTextContent('4820 kgVolumen');
    expect(week.getByTestId('progress-week-kcal')).toHaveTextContent('1900 kcalPromedio');
    expect(week.getByLabelText('Entrenamientos: 2 de 3')).toBeOnTheScreen();
  });

  it('reads "—" for the week without a plan or any log', async () => {
    mockProgress = { ...mockProgress, weekActivity: null };
    mockHome = {
      summary: { ...SUMMARY, week: { done: 0, goal: null, complete: false } },
      currentWeightKg: 70.4,
    };
    await render(<ProgressTab />);

    for (const id of ['progress-week-workouts', 'progress-week-volume', 'progress-week-kcal']) {
      expect(screen.getByTestId(id)).toHaveTextContent(/^—/);
    }
    expect(screen.getByLabelText('Volume: no data')).toBeOnTheScreen();
  });

  it('renders the honest Web state (ADR-P019)', async () => {
    mockProgress = { ...mockProgress, status: 'web-unavailable' };
    await render(<ProgressTab />);
    expect(screen.queryByTestId('progress-weight-card')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ProgressTab copy', () => {
  /** Every catalogue key this tab renders or announces. */
  const KEYS = [
    ...Object.keys(en).filter((key) => key.startsWith('progress.tab.')),
    'progress.trends.muscleMass',
    'progress.validation.weightPositive',
    'progress.validation.tooLarge',
    'progress.screen.saveErrorTitle',
    'progress.screen.saveErrorBody',
    'home.weight.empty',
    'plan.history.title',
  ] as (keyof typeof en)[];

  it('ships every key in both languages', () => {
    for (const key of KEYS) {
      expect([key, typeof es[key], typeof en[key]]).toEqual([key, 'string', 'string']);
    }
  });

  /** The literal words of a value, without its `{tokens}`. */
  const fragments = (value: string) =>
    value
      .split(/\{[a-z]+\}/i)
      .map((part) => part.replace(/^[\s.,:]+|[\s.,:]+$/g, ''))
      .filter((part) => part.length >= 4);
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  it.each([
    ['en', es],
    ['es', en],
  ] as const)('renders only %s copy', async (language, other) => {
    mockLanguage = language;
    const own = language === 'en' ? en : es;
    await render(<ProgressTab />);
    // The weight form's validation message, too.
    await fireEvent.changeText(screen.getByTestId('progress-today-weight'), '0');
    await fireEvent.press(screen.getByTestId('progress-today-weight-save'));
    // What is shown or announced: test IDs and styles are not copy.
    const text = JSON.stringify(screen.toJSON(), (key, value: unknown) =>
      key === 'testID' || key === 'style' ? undefined : value,
    );

    const leaks = KEYS.filter((key) => other[key] !== own[key]).flatMap((key) =>
      fragments(other[key]).filter((fragment) =>
        new RegExp(`(^|[^\\p{L}])${escape(fragment)}([^\\p{L}]|$)`, 'u').test(text),
      ),
    );
    expect(leaks).toEqual([]);
    // And the tab's own copy is there.
    expect(text).toContain(own['progress.tab.measurementsTitle']);
    expect(text).toContain(own['progress.tab.average']);
    expect(text).toContain(own['progress.validation.weightPositive']);
  });
});

// v8.1 guard: no string of the other language on this screen, in either language.
describe('ProgressTab language guard (v8.1)', () => {
  it.each(['en', 'es'] as const)(
    'renders no copy of the other language in %s',
    async (language) => {
      mockLanguage = language;
      await render(<ProgressTab />);
      expect(otherLanguageStrings(screen.root, language)).toEqual([]);
    },
  );
});
