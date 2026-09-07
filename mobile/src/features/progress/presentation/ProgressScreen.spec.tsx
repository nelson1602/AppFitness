import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import { lightTheme } from '@/shared/theme';

import type { ProgressState } from '../application/progress.store';
import type { BodyMeasurement, BodyWeight, ProgressSnapshot } from '../domain/progress';
import { ProgressScreen, parseLocalDate } from './ProgressScreen';

let mockState: ProgressState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../application/progress.store', () => ({
  useProgressStore: () => mockState,
}));

// UX-3D R-14. Persistence belongs to store → service → repository; the screen
// and the two chart components must never reach SQLite themselves.
jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
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

/**
 * Resolved text colour. Tone is asserted as rendered behaviour rather than by
 * prop name, so "Conflict is warning, never error" cannot regress silently
 * through a rename (BUG-007, applied here by BUG-011).
 */
function colorOf(node: { props: { style?: StyleProp<TextStyle> } }): TextStyle['color'] {
  return StyleSheet.flatten(node.props.style)?.color;
}

function setState(overrides: Partial<ProgressState> = {}): void {
  mockState = {
    status: 'ready',
    bodyWeights: [],
    bodyMeasurements: [],
    snapshots: [],
    error: null,
    load: jest.fn(),
    loadSnapshots: jest.fn(),
    recomputeSnapshots: jest.fn().mockResolvedValue(true),
    addBodyWeight: jest.fn().mockResolvedValue(true),
    editBodyWeight: jest.fn(),
    removeBodyWeight: jest.fn(),
    addBodyMeasurement: jest.fn().mockResolvedValue(true),
    editBodyMeasurement: jest.fn(),
    removeBodyMeasurement: jest.fn(),
    ...overrides,
  } as ProgressState;
}

const weight: BodyWeight = {
  id: 'bw-1',
  date: '2026-08-03',
  weightKg: 80,
  notes: null,
  version: 1,
  syncStatus: 'synced',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const week: ProgressSnapshot = {
  id: 'snap-1',
  weekStart: '2026-08-03',
  avgWeightKg: 80,
  totalVolumeKg: 12000,
  avgCalories: 2100,
  workoutCount: 3,
  isDeloadWeek: false,
  ruleVersion: '1.1.0',
  version: 1,
  syncStatus: 'synced',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const measurement: BodyMeasurement = {
  id: 'bm-1',
  date: '2026-08-03',
  bodyFatPct: 18,
  muscleMassKg: 36,
  waistCm: 82,
  hipCm: null,
  chestCm: null,
  leftArmCm: null,
  rightArmCm: null,
  neckCm: null,
  notes: null,
  version: 1,
  syncStatus: 'synced',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  setState();
});

describe('ProgressScreen (Slice 5a)', () => {
  it('loads progress on mount', async () => {
    await render(<ProgressScreen />);
    await waitFor(() => expect(mockState.load).toHaveBeenCalledTimes(1));
  });

  it('renders a loading state', async () => {
    setState({ status: 'loading' });
    await render(<ProgressScreen />);
    expect(screen.getByLabelText('Loading progress')).toBeOnTheScreen();
  });

  it('surfaces a localized load error and never renders the raw store string', async () => {
    setState({ status: 'error', error: 'SQLITE_RAW_LOAD_ERROR_do_not_show' });
    await render(<ProgressScreen />);
    expect(screen.getByText('Progress unavailable')).toBeOnTheScreen();
    expect(
      screen.getByText('Your progress could not be loaded right now. Please try again.'),
    ).toBeOnTheScreen();
    // The store's raw/internal error text is never surfaced.
    expect(screen.queryByText('SQLITE_RAW_LOAD_ERROR_do_not_show')).toBeNull();
  });

  it('surfaces a localized save error inline (distinct from load) without wiping the forms', async () => {
    setState({ status: 'ready', error: 'SQLITE_RAW_SAVE_ERROR_do_not_show' });
    await render(<ProgressScreen />);
    // Distinct localized save-error copy shown…
    expect(screen.getByText('Couldn’t save your changes')).toBeOnTheScreen();
    expect(screen.getByText('We could not save your changes. Please try again.')).toBeOnTheScreen();
    // …raw store string never rendered; load-error state NOT used; forms stay usable.
    expect(screen.queryByText('SQLITE_RAW_SAVE_ERROR_do_not_show')).toBeNull();
    expect(screen.queryByText('Progress unavailable')).not.toBeOnTheScreen();
    expect(screen.getByTestId('body-weight-submit')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-recompute')).toBeOnTheScreen();
  });

  it('renders the empty state when nothing is recorded', async () => {
    await render(<ProgressScreen />);
    expect(screen.getByText('No weight recorded yet.')).toBeOnTheScreen();
    // Weekly summary + both trends fall back to their own text-first empty states.
    expect(screen.getByText('No weekly insights yet.')).toBeOnTheScreen();
    expect(screen.getAllByText('No data yet.')).toHaveLength(3);
  });

  it('renders the latest recorded weight with a localized date when present', async () => {
    setState({ bodyWeights: [weight] });
    await render(<ProgressScreen />);
    expect(screen.getByText('80 kg on Aug 3, 2026')).toBeOnTheScreen();
  });

  it('renders the weight/volume trends and weekly summary when data exists', async () => {
    setState({
      bodyWeights: [weight, { ...weight, id: 'bw-0', date: '2026-08-01', weightKg: 81 }],
      snapshots: [week],
    });
    await render(<ProgressScreen />);
    // Weight trend (2 points → bars with per-point a11y labels). The dates are
    // localized, never the stored `YYYY-MM-DD` (BUG-013), and each label names
    // its own series and marks the latest point (UX-3D R-3, R-4).
    expect(screen.getByLabelText('Body weight, Aug 1, 2026: 81 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('Body weight, Aug 3, 2026: 80 kg · latest')).toBeOnTheScreen();
    // Weekly snapshot summary is rendered.
    expect(screen.getByTestId('weekly-snapshot-summary')).toBeOnTheScreen();
    expect(screen.getByText('Week of Aug 3, 2026')).toBeOnTheScreen();
  });

  it('renders the optional muscle-mass trend without feeding weekly snapshots', async () => {
    setState({ bodyMeasurements: [measurement] });
    await render(<ProgressScreen />);

    expect(screen.getByText('1 reading: 36 kg')).toBeOnTheScreen();
    expect(screen.getByTestId('muscle-mass-trend')).toBeOnTheScreen();
  });

  it('dispatches recompute from the "Update weekly insights" button', async () => {
    await render(<ProgressScreen />);
    await fireEvent.press(screen.getByTestId('progress-recompute'));
    await waitFor(() => expect(mockState.recomputeSnapshots).toHaveBeenCalledTimes(1));
  });

  it('recomputes weekly insights after a successful body-weight add', async () => {
    await render(<ProgressScreen />);

    await fireEvent.changeText(screen.getByTestId('field-weightKg'), '81');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body weight' }));

    await waitFor(() => expect(mockState.addBodyWeight).toHaveBeenCalledTimes(1));
    expect(mockState.addBodyWeight).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 81 }));
    await waitFor(() => expect(mockState.recomputeSnapshots).toHaveBeenCalledTimes(1));
  });

  it('does not recompute after a body-measurement add (measurements do not feed snapshots)', async () => {
    await render(<ProgressScreen />);

    await fireEvent.changeText(screen.getByTestId('field-waistCm'), '82');
    await fireEvent.press(screen.getByRole('button', { name: 'Save body measurements' }));

    await waitFor(() => expect(mockState.addBodyMeasurement).toHaveBeenCalledTimes(1));
    expect(mockState.recomputeSnapshots).not.toHaveBeenCalled();
  });

  it('parses a stored YYYY-MM-DD as a local calendar date (no UTC day shift)', () => {
    const d = parseLocalDate('2026-08-03');
    // Local calendar fields — deterministic, independent of the runner's TZ.
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // August (0-indexed)
    expect(d.getDate()).toBe(3);
  });

  it('renders localized English chrome and pluralized entry counts', async () => {
    setState({
      bodyWeights: [weight],
      bodyMeasurements: [measurement, { ...measurement, id: 'bm-2' }],
    });
    await render(<ProgressScreen />);

    expect(screen.getByText('Progress')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Record your weight and measurements. Saved on your device first, synced when online.',
      ),
    ).toBeOnTheScreen();
    // one/many wording: 1 weight entry, 2 measurement entries.
    expect(screen.getByText('1 weight entry · 2 measurement entries')).toBeOnTheScreen();
    expect(screen.getByText('Trends')).toBeOnTheScreen();
    expect(screen.getByText('Weekly insights')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Update weekly insights' })).toBeOnTheScreen();
  });

  it('renders localized Spanish chrome, decimal-comma numbers and a localized date (no UTC shift)', async () => {
    mockLanguage = 'es';
    setState({ bodyWeights: [{ ...weight, weightKg: 80.5 }], bodyMeasurements: [] });
    await render(<ProgressScreen />);

    expect(screen.getByText('Progreso')).toBeOnTheScreen();
    // Spanish decimal comma + connector "el" + day 3 (local parse, no UTC shift).
    expect(screen.getByText(/^80,5 kg el 3\b.*2026$/)).toBeOnTheScreen();
    // Spanish pluralized counts: 1 weight entry, 0 measurement entries.
    expect(screen.getByText('1 entrada de peso · 0 entradas de medidas')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Actualizar resumen semanal' })).toBeOnTheScreen();
  });

  it('renders a distinct web-unavailable state in English with no forms, metrics, trends, or recompute (ADR-P019)', async () => {
    setState({ status: 'web-unavailable', bodyWeights: [weight], snapshots: [week] });
    await render(<ProgressScreen />);

    // Normal heading preserved.
    expect(screen.getByText('Progress')).toBeOnTheScreen();
    expect(screen.getByText("Progress isn't available on the web")).toBeOnTheScreen();
    expect(
      screen.getByText('Use the AppFitness mobile app to record and track your progress.'),
    ).toBeOnTheScreen();
    // Not the generic error; no latest metric, forms, trends, snapshots, retry, or recompute.
    expect(screen.queryByText('Progress unavailable')).toBeNull();
    expect(screen.queryByText('80 kg on 2026-08-03')).toBeNull();
    expect(screen.queryByTestId('body-weight-submit')).toBeNull();
    expect(screen.queryByTestId('progress-recompute')).toBeNull();
    expect(screen.queryByText('Trends')).toBeNull();
    expect(screen.queryByText('Weekly insights')).toBeNull();
  });

  it('renders the web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setState({ status: 'web-unavailable' });
    await render(<ProgressScreen />);

    expect(screen.getByText('El progreso no está disponible en la web')).toBeOnTheScreen();
    expect(
      screen.getByText('Usa la app móvil de AppFitness para registrar y seguir tu progreso.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('progress-recompute')).toBeNull();
  });

  // BUG-011: every progress write lands `pending` and the listed rows expose
  // the field, but the screen rendered nothing — so on the product's most
  // staleness-sensitive surface a queued or diverged entry looked synced.
  it('reassures that a queued body weight is safely stored (BUG-011)', async () => {
    setState({ bodyWeights: [{ ...weight, syncStatus: 'pending' }] });
    await render(<ProgressScreen />);

    const hint = screen.getByLabelText('Progress entry saved on this device; sync pending');
    expect(hint).toBeOnTheScreen();
    // Pending means safely stored — it must reassure, never alarm.
    expect(colorOf(hint)).toBe(lightTheme.colors.onSurfaceVariant);
    expect(colorOf(hint)).not.toBe(lightTheme.colors.error);
  });

  it('reports a diverged body weight as warning, not error (BUG-011)', async () => {
    setState({ bodyWeights: [{ ...weight, syncStatus: 'conflict' }] });
    await render(<ProgressScreen />);

    const hint = screen.getByLabelText('Progress entry sync conflict');
    expect(hint).toBeOnTheScreen();
    expect(colorOf(hint)).toBe(lightTheme.colors.warning);
    expect(colorOf(hint)).not.toBe(lightTheme.colors.error);
    expect(
      screen.queryByLabelText('Progress entry saved on this device; sync pending'),
    ).not.toBeOnTheScreen();
  });

  it('leaves a synced body weight with no sync hint at all (BUG-011)', async () => {
    setState({ bodyWeights: [{ ...weight, syncStatus: 'synced' }] });
    await render(<ProgressScreen />);

    expect(screen.queryByLabelText('Progress entry sync conflict')).not.toBeOnTheScreen();
    expect(
      screen.queryByLabelText('Progress entry saved on this device; sync pending'),
    ).not.toBeOnTheScreen();
  });

  it('reports the conflict without offering a resolution (BUG-012 stays open)', async () => {
    setState({ bodyWeights: [{ ...weight, syncStatus: 'conflict' }] });
    await render(<ProgressScreen />);

    // Report-only: the hint is the bare localized word, with no choose action.
    expect(screen.getByLabelText('Progress entry sync conflict')).toHaveTextContent('Conflict');
  });

  it('localizes the conflict hint in Spanish (BUG-011)', async () => {
    mockLanguage = 'es';
    setState({ bodyWeights: [{ ...weight, syncStatus: 'conflict' }] });
    await render(<ProgressScreen />);

    expect(
      screen.getByLabelText('Conflicto de sincronización del registro de progreso'),
    ).toHaveTextContent('Conflicto');
  });

  /**
   * BUG-013 / UX-3D R-1 and R-2. The bars carry no visible text, so these
   * labels are reached ONLY through assistive technology — they were the one
   * date on this surface still announced in raw storage format.
   *
   * English is asserted exactly, Spanish by day + year, following this file's
   * existing convention: the Spanish month abbreviation is ICU-version
   * dependent, so pinning it would make the suite brittle rather than stricter.
   *
   * These assert the RESOLVED label only. No VoiceOver, TalkBack or browser-AT
   * outcome is claimed here — that remains the unrun UX-4C pass.
   */
  describe('trend point labels are localized (BUG-013)', () => {
    /**
     * Any stored-format date, in any accessible label. Written with character
     * classes so the pattern needs no escaping to read correctly in review.
     */
    const RAW_ISO = /[0-9]{4}-[0-9]{2}-[0-9]{2}/;
    /** Any label carrying a value, i.e. every per-bar point label. */
    const POINT_LABEL = /: [0-9]/;

    // TrendBars falls back to text below two points, so every series here has
    // two — a one-point fixture would render no per-bar label to assert on.
    const weights = [weight, { ...weight, id: 'bw-0', date: '2026-08-01', weightKg: 81 }];
    const measurements = [
      measurement,
      { ...measurement, id: 'bm-0', date: '2026-08-01', muscleMassKg: 35 },
    ];
    const weeks = [week, { ...week, id: 'snap-0', weekStart: '2026-07-27', totalVolumeKg: 11000 }];

    it('localizes the weight point labels in English', async () => {
      setState({ bodyWeights: weights });
      await render(<ProgressScreen />);

      expect(screen.getByLabelText('Body weight, Aug 1, 2026: 81 kg')).toBeOnTheScreen();
      expect(screen.getByLabelText('Body weight, Aug 3, 2026: 80 kg · latest')).toBeOnTheScreen();
    });

    it('localizes the weight point labels in Spanish', async () => {
      mockLanguage = 'es';
      setState({ bodyWeights: weights });
      await render(<ProgressScreen />);

      // Days 1 and 3 from the local parse (no UTC shift), each label still
      // carrying its series title, value and unit. The month abbreviation is
      // left unpinned: it is ICU-version dependent, exactly as the Spanish test
      // above treats it.
      expect(screen.getByLabelText(/^Peso corporal, 1 [^0-9]+2026: 81 kg$/)).toBeOnTheScreen();
      expect(
        screen.getByLabelText(/^Peso corporal, 3 [^0-9]+2026: 80 kg · última$/),
      ).toBeOnTheScreen();
    });

    it('localizes the muscle-mass point labels in English', async () => {
      setState({ bodyMeasurements: measurements });
      await render(<ProgressScreen />);

      expect(screen.getByLabelText('Muscle mass, Aug 1, 2026: 35 kg')).toBeOnTheScreen();
      expect(screen.getByLabelText('Muscle mass, Aug 3, 2026: 36 kg · latest')).toBeOnTheScreen();
    });

    it('prefixes the weekly-volume point labels with "Week of" in English', async () => {
      setState({ snapshots: weeks });
      await render(<ProgressScreen />);

      // A volume point is a week, not a day — R-2. The series title still comes
      // first, so the week prefix qualifies the date rather than the series.
      expect(
        screen.getByLabelText('Weekly training volume, Week of Jul 27, 2026: 11,000 kg'),
      ).toBeOnTheScreen();
      expect(
        screen.getByLabelText('Weekly training volume, Week of Aug 3, 2026: 12,000 kg · latest'),
      ).toBeOnTheScreen();
    });

    it('prefixes the weekly-volume point labels with "Semana del" in Spanish', async () => {
      mockLanguage = 'es';
      setState({ snapshots: weeks });
      await render(<ProgressScreen />);

      expect(
        screen.getByLabelText(
          /^Volumen de entrenamiento semanal, Semana del 27 [^0-9]+2026: 11[.]000 kg$/,
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByLabelText(
          /^Volumen de entrenamiento semanal, Semana del 3 [^0-9]+2026: 12[.]000 kg · última$/,
        ),
      ).toBeOnTheScreen();
    });

    it('exposes NO raw YYYY-MM-DD in any accessible label, in English', async () => {
      setState({
        bodyWeights: weights,
        bodyMeasurements: measurements,
        snapshots: weeks,
      });
      await render(<ProgressScreen />);

      // All three series render bars here, so this proves the absence across
      // every point label at once: a series added later cannot reintroduce the
      // defect unnoticed. The count guards the assertion against passing
      // vacuously if the bars ever stop rendering.
      expect(screen.getAllByLabelText(POINT_LABEL).length).toBeGreaterThanOrEqual(6);
      expect(screen.queryAllByLabelText(RAW_ISO)).toHaveLength(0);
    });

    it('exposes NO raw YYYY-MM-DD in any accessible label, in Spanish', async () => {
      mockLanguage = 'es';
      setState({
        bodyWeights: weights,
        bodyMeasurements: measurements,
        snapshots: weeks,
      });
      await render(<ProgressScreen />);

      expect(screen.getAllByLabelText(POINT_LABEL).length).toBeGreaterThanOrEqual(6);
      expect(screen.queryAllByLabelText(RAW_ISO)).toHaveLength(0);
    });
  });

  /**
   * UX-3D R-3…R-14 as assembled by the screen (`.ai/20_PROGRESS_NONVISUAL.md`).
   * `TrendBars.spec.tsx` and `WeeklySnapshotSummary.spec.tsx` own the component
   * contracts; these assert what the three charts do when they sit in one card
   * together, which is the case the specification exists for.
   *
   * Structure only. No VoiceOver, TalkBack, browser-AT, large-text or
   * physical-device outcome is claimed — that is the unrun UX-4C manual pass.
   */
  describe('progress non-visual equivalent (UX-3D)', () => {
    const weights = [weight, { ...weight, id: 'bw-0', date: '2026-08-01', weightKg: 81 }];
    const measurements = [
      measurement,
      { ...measurement, id: 'bm-0', date: '2026-08-01', muscleMassKg: 35 },
    ];
    const weeks = [week, { ...week, id: 'snap-0', weekStart: '2026-07-27', totalVolumeKg: 11000 }];

    function allSeries(): void {
      setState({ bodyWeights: weights, bodyMeasurements: measurements, snapshots: weeks });
    }

    it('attributes every bar to its own chart when all three render together (R-3)', async () => {
      allSeries();
      await render(<ProgressScreen />);

      const labels = screen
        .getAllByLabelText(/: [0-9]/)
        .map((bar) => String(bar.props.accessibilityLabel));
      expect(labels).toHaveLength(6);
      // Three charts sit in one card, so a bar focused in isolation must carry
      // its series or the date and kilogram figure could belong to any of them.
      expect(labels.filter((l) => l.startsWith('Body weight, '))).toHaveLength(2);
      expect(labels.filter((l) => l.startsWith('Muscle mass, '))).toHaveLength(2);
      expect(labels.filter((l) => l.startsWith('Weekly training volume, '))).toHaveLength(2);
    });

    it('marks exactly one latest point per chart (R-4)', async () => {
      allSeries();
      await render(<ProgressScreen />);

      // Three charts → three latest markers, one each; the accent fill is no
      // longer the only way to find the newest bar.
      expect(screen.getAllByLabelText(/ · latest$/)).toHaveLength(3);
      expect(screen.getByLabelText('Body weight, Aug 3, 2026: 80 kg · latest')).toBeOnTheScreen();
      expect(screen.getByLabelText('Muscle mass, Aug 3, 2026: 36 kg · latest')).toBeOnTheScreen();
      expect(
        screen.getByLabelText('Weekly training volume, Week of Aug 3, 2026: 12,000 kg · latest'),
      ).toBeOnTheScreen();
    });

    it('renders a visible descriptor per chart naming series, count and order (R-5)', async () => {
      allSeries();
      await render(<ProgressScreen />);

      expect(screen.getByText('Body weight · 2 readings · oldest to newest')).toBeOnTheScreen();
      expect(screen.getByText('Muscle mass · 2 readings · oldest to newest')).toBeOnTheScreen();
      expect(
        screen.getByText('Weekly training volume · 2 readings · oldest to newest'),
      ).toBeOnTheScreen();
    });

    it('renders the descriptors in Spanish (R-5)', async () => {
      mockLanguage = 'es';
      allSeries();
      await render(<ProgressScreen />);

      expect(
        screen.getByText('Peso corporal · 2 lecturas · de la más antigua a la más reciente'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText('Masa muscular · 2 lecturas · de la más antigua a la más reciente'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Volumen de entrenamiento semanal · 2 lecturas · de la más antigua a la más reciente',
        ),
      ).toBeOnTheScreen();
    });

    it('renders no window notice while every reading fits the window (R-6)', async () => {
      allSeries();
      await render(<ProgressScreen />);

      // Two points per series, window 12: nothing is dropped, so an
      // unqualified range/direction reading stays unqualified.
      expect(screen.queryByText('Showing only the most recent readings')).toBeNull();
      expect(screen.queryByTestId('weight-trend-window-notice')).toBeNull();
      expect(screen.queryByTestId('muscle-mass-trend-window-notice')).toBeNull();
      expect(screen.queryByTestId('volume-trend-window-notice')).toBeNull();
    });

    it('renders the window notice for the truncated series only (R-6)', async () => {
      // 14 daily weights against a 12-point window; the other two series are
      // short, so the notice must not leak across charts.
      setState({
        bodyWeights: Array.from({ length: 14 }, (_, i) => ({
          ...weight,
          id: `bw-${i}`,
          date: `2026-08-${String(i + 1).padStart(2, '0')}`,
          weightKg: 80 + i,
        })),
        bodyMeasurements: measurements,
        snapshots: weeks,
      });
      await render(<ProgressScreen />);

      expect(screen.getByTestId('weight-trend-window-notice')).toHaveTextContent(
        'Showing only the most recent readings',
      );
      expect(screen.getByText('Body weight · 12 readings · oldest to newest')).toBeOnTheScreen();
      expect(screen.queryByTestId('muscle-mass-trend-window-notice')).toBeNull();
      expect(screen.queryByTestId('volume-trend-window-notice')).toBeNull();
      expect(screen.getAllByText('Showing only the most recent readings')).toHaveLength(1);
    });

    it('renders no descriptor or notice for the empty and single-point series (R-7)', async () => {
      // One weight only: its chart falls back to text, the other two are empty.
      setState({ bodyWeights: [weight] });
      await render(<ProgressScreen />);

      expect(screen.getByText('1 reading: 80 kg')).toBeOnTheScreen();
      expect(screen.getAllByText('No data yet.')).toHaveLength(2);
      expect(screen.queryByText(/oldest to newest/)).toBeNull();
      expect(screen.queryByText('Showing only the most recent readings')).toBeNull();
      for (const id of ['weight-trend', 'muscle-mass-trend', 'volume-trend']) {
        expect(screen.queryByTestId(`${id}-descriptor`)).toBeNull();
        expect(screen.queryByTestId(`${id}-window-notice`)).toBeNull();
        expect(screen.queryByTestId(`${id}-bars`)).toBeNull();
      }
    });

    it('orders each chart oldest → newest, reversing the store (R-8)', async () => {
      allSeries();
      await render(<ProgressScreen />);

      // The store holds every list newest-first; the charts read the other way,
      // which is exactly what the descriptor claims.
      const labelsOf = (testID: string): string[] =>
        screen
          .getByTestId(`${testID}-bars`)
          .queryAll((node) => node.props.accessible === true)
          .map((bar) => String(bar.props.accessibilityLabel));

      expect(labelsOf('weight-trend')).toEqual([
        'Body weight, Aug 1, 2026: 81 kg',
        'Body weight, Aug 3, 2026: 80 kg · latest',
      ]);
      expect(labelsOf('volume-trend')).toEqual([
        'Weekly training volume, Week of Jul 27, 2026: 11,000 kg',
        'Weekly training volume, Week of Aug 3, 2026: 12,000 kg · latest',
      ]);
    });

    it('lets no ancestor swallow a bar or a metric row on the assembled screen (R-12)', async () => {
      allSeries();
      await render(<ProgressScreen />);

      // The charts and the weekly summary sit inside Cards, which is where a
      // wrapper would realistically creep in and make the leaves unreachable.
      const bars = screen.getAllByLabelText(/: [0-9]/);
      const rows = screen.getAllByLabelText(/^(Avg weight|Total volume|Workouts), /);
      expect(bars).toHaveLength(6);
      expect(rows).toHaveLength(3);

      for (const leaf of [...bars, ...rows]) {
        expect(leaf.props.accessible).toBe(true);
        // EVERY ancestor, not just the nearest, and on BOTH counts. `accessible`
        // groups the subtree into one element on iOS; an `accessibilityLabel`
        // alone makes the ancestor a named element competing with the leaf for
        // the accessible name. Either is enough to stop the leaf being reached
        // as itself, so neither is permitted above an intended focus target.
        for (let node = leaf.parent; node; node = node.parent) {
          expect(node.props.accessible).not.toBe(true);
          expect(node.props.accessibilityLabel).toBeUndefined();
        }
      }
    });

    it('states the earlier-weeks order, opposite to the charts (R-11)', async () => {
      allSeries();
      await render(<ProgressScreen />);

      // Both orders are stated on the same screen, because they genuinely differ.
      expect(screen.getByText('Earlier weeks · newest first')).toBeOnTheScreen();
      expect(
        screen.getByText('Weekly training volume · 2 readings · oldest to newest'),
      ).toBeOnTheScreen();
    });

    it('introduces no live region and no imperative announcement (R-13)', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      allSeries();
      await render(<ProgressScreen />);

      const rendered = screen.container.queryAll(() => true);
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.filter((node) => node.props.accessibilityLiveRegion !== undefined)).toEqual(
        [],
      );
      expect(announce).not.toHaveBeenCalled();
      announce.mockRestore();
    });

    it('drives the charts from the store only, never SQLite (R-14)', async () => {
      allSeries();
      await render(<ProgressScreen />);

      await fireEvent.press(screen.getByTestId('progress-recompute'));
      await waitFor(() => expect(mockState.recomputeSnapshots).toHaveBeenCalledTimes(1));

      // The bars rendered from store-supplied points…
      expect(screen.getAllByLabelText(/: [0-9]/)).toHaveLength(6);
      // …and neither the screen nor the two chart components touched the
      // persistence layer to do it.
      expect(jest.mocked(inTransaction)).not.toHaveBeenCalled();
      expect(jest.mocked(queryAll)).not.toHaveBeenCalled();
      expect(jest.mocked(queryFirst)).not.toHaveBeenCalled();
      expect(jest.mocked(run)).not.toHaveBeenCalled();
    });
  });
});
