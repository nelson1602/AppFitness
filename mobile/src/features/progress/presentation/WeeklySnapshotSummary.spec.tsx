import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import { lightTheme } from '@/shared/theme';

import { useProgressStore } from '../application/progress.store';
import type { ProgressSnapshot } from '../domain/progress';
import { WeeklySnapshotSummary } from './WeeklySnapshotSummary';

let mockLanguage: 'en' | 'es' = 'en';

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

// UX-3D R-14. The summary is pure presentation: it renders the snapshots the
// caller already holds, so it must never reach the store or SQLite itself
// (`.ai/06_MOBILE.md` §Screen Principles).
jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));
jest.mock('../application/progress.store', () => ({ useProgressStore: jest.fn() }));

/** A rendered host element, as the queries return it. */
type Node = ReturnType<typeof screen.getByTestId>;

/** Resolved text colour, so tone is asserted as rendered behaviour (BUG-011). */
function colorOf(node: { props: { style?: StyleProp<TextStyle> } }): TextStyle['color'] {
  return StyleSheet.flatten(node.props.style)?.color;
}

/** Every host ancestor of `node` that is itself an accessibility element. */
function accessibleAncestors(node: Node): Node[] {
  const found: Node[] = [];
  for (let current = node.parent; current; current = current.parent) {
    if (current.props.accessible === true) found.push(current);
  }
  return found;
}

/** The accessible leaves inside the summary, in rendered document order. */
function leaves(): Node[] {
  return screen
    .getByTestId('weekly-snapshot-summary')
    .queryAll((node) => node.props.accessible === true);
}

function snap(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    id: 'snap-1',
    weekStart: '2026-08-03',
    avgWeightKg: 80.4,
    totalVolumeKg: 12000,
    avgCalories: 2100,
    workoutCount: 3,
    isDeloadWeek: false,
    ruleVersion: '1.1.0',
    version: 1,
    syncStatus: 'synced',
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    ...overrides,
  };
}

describe('WeeklySnapshotSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
  });

  it('renders the empty state when there are no snapshots', async () => {
    await render(<WeeklySnapshotSummary snapshots={[]} />);
    expect(screen.getByText('No weekly insights yet.')).toBeOnTheScreen();
  });

  it('renders the latest week metrics with a localized date and numbers', async () => {
    await render(<WeeklySnapshotSummary snapshots={[snap()]} />);
    expect(screen.getByText('Week of Aug 3, 2026')).toBeOnTheScreen();
    expect(screen.getByText('80.4 kg')).toBeOnTheScreen();
    // Localized thousands separator (en): 12,000 / 2,100.
    expect(screen.getByText('12,000 kg')).toBeOnTheScreen();
    expect(screen.getByText('2,100 kcal')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
  });

  it('renders nulls as an em dash', async () => {
    await render(
      <WeeklySnapshotSummary
        snapshots={[snap({ avgWeightKg: null, totalVolumeKg: null, avgCalories: null })]}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the deload flag as text (Yes) when set, No otherwise', async () => {
    const { rerender } = await render(
      <WeeklySnapshotSummary snapshots={[snap({ isDeloadWeek: true })]} />,
    );
    expect(screen.getByText('Yes')).toBeOnTheScreen();

    await rerender(<WeeklySnapshotSummary snapshots={[snap({ isDeloadWeek: false })]} />);
    expect(screen.getByText('No')).toBeOnTheScreen();
  });

  it('lists earlier weeks after the latest', async () => {
    await render(
      <WeeklySnapshotSummary
        snapshots={[
          snap({ id: 'w1', weekStart: '2026-08-03' }),
          snap({ id: 'w2', weekStart: '2026-07-27', totalVolumeKg: 9000, workoutCount: 2 }),
        ]}
      />,
    );
    // The heading now carries its order as visible text (UX-3D R-11).
    expect(screen.getByText('Earlier weeks · newest first')).toBeOnTheScreen();
    expect(screen.getByText(/Jul 27, 2026: 9,000 kg volume · 2 workouts/)).toBeOnTheScreen();
  });

  it('renders the latest week metrics in Spanish (labels, Sí, localized date/numbers)', async () => {
    mockLanguage = 'es';
    await render(<WeeklySnapshotSummary snapshots={[snap({ isDeloadWeek: true })]} />);

    // Month abbreviation varies by ICU; assert "Semana del" + day 3 + 2026 (no UTC shift).
    expect(screen.getByText(/^Semana del 3\b.*2026$/)).toBeOnTheScreen();
    expect(screen.getByText('Peso promedio')).toBeOnTheScreen();
    expect(screen.getByText('Volumen total')).toBeOnTheScreen();
    expect(screen.getByText('Calorías promedio')).toBeOnTheScreen();
    expect(screen.getByText('Entrenamientos')).toBeOnTheScreen();
    expect(screen.getByText('Semana de descarga')).toBeOnTheScreen();
    // Deload true → "Sí". Spanish decimal comma; thousands dot only for 5+ digits
    // (12.000), while 4-digit values are ungrouped (2100) per the es locale.
    expect(screen.getByText('Sí')).toBeOnTheScreen();
    expect(screen.getByText('80,4 kg')).toBeOnTheScreen();
    expect(screen.getByText('12.000 kg')).toBeOnTheScreen();
    expect(screen.getByText('2100 kcal')).toBeOnTheScreen();
  });

  it('renders "No" for a non-deload week in Spanish', async () => {
    mockLanguage = 'es';
    await render(<WeeklySnapshotSummary snapshots={[snap({ isDeloadWeek: false })]} />);
    expect(screen.getByText('No')).toBeOnTheScreen();
  });

  it('renders the Spanish earlier-weeks summary with one/many grammar and a deload tag', async () => {
    mockLanguage = 'es';
    await render(
      <WeeklySnapshotSummary
        snapshots={[
          snap({ id: 'w1', weekStart: '2026-08-03' }),
          snap({
            id: 'w2',
            weekStart: '2026-07-27',
            totalVolumeKg: 9000,
            workoutCount: 1,
            isDeloadWeek: true,
          }),
        ]}
      />,
    );
    expect(
      screen.getByText('Semanas anteriores · de la más reciente a la más antigua'),
    ).toBeOnTheScreen();
    // day 27 + 2026 (no UTC shift); 9000 is 4-digit → ungrouped in es; singular
    // "entrenamiento"; deload tag "descarga".
    expect(
      screen.getByText(/27\b.*2026: 9000 kg de volumen · 1 entrenamiento · descarga/),
    ).toBeOnTheScreen();
  });

  // BUG-011: snapshots are listed rows carrying `syncStatus`, both for the
  // latest week and for each earlier week.
  it('reports a diverged latest snapshot as warning, not error (BUG-011)', async () => {
    await render(<WeeklySnapshotSummary snapshots={[snap({ syncStatus: 'conflict' })]} />);

    const hint = screen.getByLabelText('Progress entry sync conflict');
    expect(hint).toBeOnTheScreen();
    expect(colorOf(hint)).toBe(lightTheme.colors.warning);
    expect(colorOf(hint)).not.toBe(lightTheme.colors.error);
  });

  it('reassures that a queued latest snapshot is safely stored (BUG-011)', async () => {
    await render(<WeeklySnapshotSummary snapshots={[snap({ syncStatus: 'pending' })]} />);

    const hint = screen.getByLabelText('Progress entry saved on this device; sync pending');
    expect(colorOf(hint)).toBe(lightTheme.colors.onSurfaceVariant);
  });

  it('reports an earlier week that diverged (BUG-011)', async () => {
    await render(
      <WeeklySnapshotSummary
        snapshots={[
          snap({ id: 'latest', syncStatus: 'synced' }),
          snap({ id: 'older', weekStart: '2026-07-27', syncStatus: 'conflict' }),
        ]}
      />,
    );

    // Exactly one hint: the earlier row, not the synced latest block.
    const hints = screen.getAllByLabelText('Progress entry sync conflict');
    expect(hints).toHaveLength(1);
    expect(colorOf(hints[0])).toBe(lightTheme.colors.warning);
  });

  it('leaves fully synced snapshots with no sync hint at all (BUG-011)', async () => {
    await render(
      <WeeklySnapshotSummary
        snapshots={[snap({ id: 'a' }), snap({ id: 'b', weekStart: '2026-07-27' })]}
      />,
    );

    expect(screen.queryByLabelText('Progress entry sync conflict')).not.toBeOnTheScreen();
    expect(
      screen.queryByLabelText('Progress entry saved on this device; sync pending'),
    ).not.toBeOnTheScreen();
  });

  /**
   * UX-3D R-10…R-14 (`.ai/20_PROGRESS_NONVISUAL.md`). Structure only: these are
   * resolved labels and tree shape in a test renderer. No VoiceOver, TalkBack,
   * browser-AT, large-text or physical-device outcome is claimed — that is the
   * unrun UX-4C manual pass.
   */
  describe('non-visual equivalent (UX-3D)', () => {
    it('announces each metric row as label then value (R-10)', async () => {
      await render(<WeeklySnapshotSummary snapshots={[snap({ isDeloadWeek: true })]} />);

      expect(screen.getByLabelText('Avg weight, 80.4 kg')).toBeOnTheScreen();
      expect(screen.getByLabelText('Total volume, 12,000 kg')).toBeOnTheScreen();
      expect(screen.getByLabelText('Avg calories, 2,100 kcal')).toBeOnTheScreen();
      expect(screen.getByLabelText('Workouts, 3')).toBeOnTheScreen();
      // The deload flag stays informational text, never colour (Flow 7).
      expect(screen.getByLabelText('Deload week, Yes')).toBeOnTheScreen();
    });

    it('shows "—" but announces "Not recorded" for a null metric (R-10)', async () => {
      await render(
        <WeeklySnapshotSummary
          snapshots={[snap({ avgWeightKg: null, totalVolumeKg: null, avgCalories: null })]}
        />,
      );

      // The two differ deliberately: "dash" carries no meaning, and "zero",
      // "none" or "unknown" would each be an invention.
      expect(screen.getAllByText('—')).toHaveLength(3);
      expect(screen.getByLabelText('Avg weight, Not recorded')).toBeOnTheScreen();
      expect(screen.getByLabelText('Total volume, Not recorded')).toBeOnTheScreen();
      expect(screen.getByLabelText('Avg calories, Not recorded')).toBeOnTheScreen();
      // No row announces the visual convention itself.
      expect(screen.queryAllByLabelText(/—/)).toHaveLength(0);
      // A recorded value still announces what it shows.
      expect(screen.getByLabelText('Workouts, 3')).toBeOnTheScreen();
    });

    it('announces "Sin registrar" for a null metric in Spanish (R-10)', async () => {
      mockLanguage = 'es';
      await render(<WeeklySnapshotSummary snapshots={[snap({ avgCalories: null })]} />);

      expect(screen.getByText('—')).toBeOnTheScreen();
      expect(screen.getByLabelText('Calorías promedio, Sin registrar')).toBeOnTheScreen();
      expect(screen.getByLabelText('Peso promedio, 80,4 kg')).toBeOnTheScreen();
      expect(screen.queryAllByLabelText(/—/)).toHaveLength(0);
    });

    it('states the earlier-weeks order and lists the weeks in it (R-11)', async () => {
      await render(
        <WeeklySnapshotSummary
          snapshots={[
            snap({ id: 'w0', weekStart: '2026-08-03' }),
            snap({ id: 'w1', weekStart: '2026-07-27', totalVolumeKg: 9000 }),
            snap({ id: 'w2', weekStart: '2026-07-20', totalVolumeKg: 8000 }),
          ]}
        />,
      );

      // Visible, because a reader moving here from the oldest-first charts must
      // not carry that order over.
      expect(screen.getByText('Earlier weeks · newest first')).toBeOnTheScreen();

      // …and the listed weeks really are newest-first. `getAllByText` returns
      // document order, which is also the reading order.
      const sentences = screen.getAllByText(/kg volume/);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toHaveTextContent(/^Jul 27, 2026: /);
      expect(sentences[1]).toHaveTextContent(/^Jul 20, 2026: /);
    });

    it('omits the earlier-weeks heading when there is only a latest week (R-11)', async () => {
      await render(<WeeklySnapshotSummary snapshots={[snap()]} />);

      expect(screen.queryByText('Earlier weeks · newest first')).toBeNull();
      expect(screen.queryByText(/newest first/)).toBeNull();
    });

    it('lets no container swallow a metric row (R-12)', async () => {
      await render(
        <WeeklySnapshotSummary
          snapshots={[snap({ id: 'w0' }), snap({ id: 'w1', weekStart: '2026-07-27' })]}
        />,
      );

      const root = screen.getByTestId('weekly-snapshot-summary');
      expect(root.props.accessible).toBeFalsy();
      expect(root.props.accessibilityLabel).toBeUndefined();

      // The latest-week block and the earlier-weeks list are the root's two
      // children: plain layout Views, so neither groups what it contains.
      const blocks = root.children.filter((child): child is Node => typeof child !== 'string');
      expect(blocks).toHaveLength(2);
      for (const block of blocks) {
        expect(block.props.accessible).toBeFalsy();
        expect(block.props.accessibilityLabel).toBeUndefined();
      }

      // Five metric rows, each one intentional accessible leaf with no
      // accessible ancestor above it.
      const rows = leaves();
      expect(rows).toHaveLength(5);
      for (const row of rows) {
        expect(row.props.accessible).toBe(true);
        expect(String(row.props.accessibilityLabel)).toMatch(/^[^,]+, .+$/);
        expect(accessibleAncestors(row)).toEqual([]);
      }
    });

    it('marks both metric-row children explicitly non-accessible (R-12)', async () => {
      await render(<WeeklySnapshotSummary snapshots={[snap()]} />);

      const row = screen.getByLabelText('Avg weight, 80.4 kg');
      const children = row.children.filter((child): child is Node => typeof child !== 'string');
      expect(children).toHaveLength(2);

      // React Native `Text` is an accessibility element by default, so leaving
      // this implicit would nest two named elements under the labelled row.
      // `false`, not merely falsy: an absent prop would mean the default is
      // still in force.
      for (const child of children) {
        expect(child.props.accessible).toBe(false);
        expect(child.props.accessibilityLabel).toBeUndefined();
      }

      // The visible label/value text is unchanged and still rendered…
      expect(children.map((child) => String(child.children[0]))).toEqual(['Avg weight', '80.4 kg']);
      // …and the row keeps the localized combined label it announces.
      expect(row.props.accessible).toBe(true);
      expect(row.props.accessibilityLabel).toBe('Avg weight, 80.4 kg');
    });

    it('introduces no live region and no imperative announcement (R-13)', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      const { rerender } = await render(<WeeklySnapshotSummary snapshots={[snap()]} />);

      // A recompute re-renders the whole ready arm; a live region here would
      // make that speak, and the codebase deliberately has none.
      await rerender(<WeeklySnapshotSummary snapshots={[snap({ totalVolumeKg: 13000 })]} />);

      const rendered = screen.container.queryAll(() => true);
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.filter((node) => node.props.accessibilityLiveRegion !== undefined)).toEqual(
        [],
      );
      expect(announce).not.toHaveBeenCalled();
      announce.mockRestore();
    });

    it('never reads a store, repository or SQLite (R-14)', async () => {
      await render(<WeeklySnapshotSummary snapshots={[snap()]} />);

      // It rendered from its props alone…
      expect(leaves()).toHaveLength(5);
      // …and touched neither the store nor the persistence layer.
      expect(jest.mocked(useProgressStore)).not.toHaveBeenCalled();
      expect(jest.mocked(inTransaction)).not.toHaveBeenCalled();
      expect(jest.mocked(queryAll)).not.toHaveBeenCalled();
      expect(jest.mocked(queryFirst)).not.toHaveBeenCalled();
      expect(jest.mocked(run)).not.toHaveBeenCalled();
    });
  });
});
