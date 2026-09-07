import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';

import { useProgressStore } from '../application/progress.store';
import { TrendBars, type TrendPoint } from './TrendBars';

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

// UX-3D R-14. The chart is pure presentation: the caller supplies resolved
// points, so the component must never reach the store or SQLite itself
// (`.ai/06_MOBILE.md` §Screen Principles). Spying on both boundaries proves it
// rather than trusting the import list.
jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));
jest.mock('../application/progress.store', () => ({ useProgressStore: jest.fn() }));

/** A rendered host element, as the queries return it. */
type Node = ReturnType<typeof screen.getByTestId>;

function points(values: number[]): TrendPoint[] {
  return values.map((v, i) => ({ label: `2026-08-0${i + 1}`, value: v }));
}

/** The accessible bar leaves of one chart, in rendered document order. */
function bars(testID: string): Node[] {
  return screen.getByTestId(`${testID}-bars`).queryAll((node) => node.props.accessible === true);
}

/** Each bar's announced label, in rendered document order. */
function barLabels(testID: string): string[] {
  return bars(testID).map((bar) => String(bar.props.accessibilityLabel));
}

/** Every host ancestor of `node` that is itself an accessibility element. */
function accessibleAncestors(node: Node): Node[] {
  const found: Node[] = [];
  for (let current = node.parent; current; current = current.parent) {
    if (current.props.accessible === true) found.push(current);
  }
  return found;
}

describe('TrendBars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
  });

  it('renders a text-first fallback for an empty series (no bars)', async () => {
    await render(<TrendBars title="Body weight" data={[]} unit=" kg" testID="t" />);
    expect(screen.getByText('No data yet.')).toBeOnTheScreen();
  });

  it('renders a text-first fallback for a single point (no trend)', async () => {
    await render(<TrendBars title="Body weight" data={points([80])} unit=" kg" testID="t" />);
    expect(screen.getByText('1 reading: 80 kg')).toBeOnTheScreen();
  });

  it('renders one bar per point with a per-bar accessibility label', async () => {
    await render(
      <TrendBars title="Body weight" data={points([80, 81, 79.5])} unit=" kg" testID="t" />,
    );
    // Every label carries its own series title (R-3); the newest also carries
    // the latest marker (R-4).
    expect(screen.getByLabelText('Body weight, 2026-08-01: 80 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('Body weight, 2026-08-02: 81 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('Body weight, 2026-08-03: 79.5 kg · latest')).toBeOnTheScreen();
  });

  it('summarizes latest, range, and a downward delta with direction', async () => {
    await render(
      <TrendBars title="Body weight" data={points([80, 82, 79])} unit=" kg" testID="t" />,
    );
    // latest 79, min 79 / max 82, delta 79 − 80 = −1 → "down 1"
    expect(screen.getByText('Latest 79 kg · range 79–82 kg · down 1 kg')).toBeOnTheScreen();
  });

  it('reports a flat trend when first equals latest', async () => {
    await render(
      <TrendBars title="Body weight" data={points([80, 85, 80])} unit=" kg" testID="t" />,
    );
    expect(screen.getByText('Latest 80 kg · range 80–85 kg · flat 0 kg')).toBeOnTheScreen();
  });

  it('handles a max==min series without dividing by zero (still renders bars)', async () => {
    await render(
      <TrendBars title="Body weight" data={points([80, 80, 80])} unit=" kg" testID="t" />,
    );
    expect(screen.getByText('Latest 80 kg · range 80–80 kg · flat 0 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('Body weight, 2026-08-01: 80 kg')).toBeOnTheScreen();
  });

  it('keeps only the most recent maxBars points', async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ label: `d${i}`, value: i }));
    await render(<TrendBars title="V" data={many} unit="" maxBars={12} testID="t" />);
    // Oldest three (d0–d2) are dropped; d3 is the first kept bar.
    expect(screen.queryByLabelText('V, d0: 0')).toBeNull();
    expect(screen.getByLabelText('V, d3: 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('V, d14: 14 · latest')).toBeOnTheScreen();
  });

  it('renders the Spanish empty and one-reading states (decimal comma)', async () => {
    mockLanguage = 'es';
    const { rerender } = await render(<TrendBars title="Peso" data={[]} unit=" kg" testID="t" />);
    expect(screen.getByText('Sin datos aún.')).toBeOnTheScreen();

    await rerender(<TrendBars title="Peso" data={points([80.5])} unit=" kg" testID="t" />);
    expect(screen.getByText('1 lectura: 80,5 kg')).toBeOnTheScreen();
  });

  it('summarizes latest/range with a downward "baja" direction in Spanish', async () => {
    mockLanguage = 'es';
    await render(<TrendBars title="Peso" data={points([80, 82, 79])} unit=" kg" testID="t" />);
    expect(screen.getByText('Último 79 kg · rango 79–82 kg · baja 1 kg')).toBeOnTheScreen();
  });

  it('localizes the up ("sube") and flat ("estable") direction labels in Spanish', async () => {
    mockLanguage = 'es';
    const { rerender } = await render(
      <TrendBars title="V" data={points([80, 79, 82])} unit=" kg" testID="t" />,
    );
    // first 80 → latest 82 → +2 → "sube"
    expect(screen.getByText('Último 82 kg · rango 79–82 kg · sube 2 kg')).toBeOnTheScreen();

    await rerender(<TrendBars title="V" data={points([80, 85, 80])} unit=" kg" testID="t" />);
    expect(screen.getByText('Último 80 kg · rango 80–85 kg · estable 0 kg')).toBeOnTheScreen();
  });

  it('formats thousands with the Spanish separator in the summary', async () => {
    mockLanguage = 'es';
    await render(
      <TrendBars title="V" data={points([10000, 12000, 11000])} unit=" kg" testID="t" />,
    );
    // first 10000 → latest 11000 → +1000 → "sube"; 5-digit values grouped
    // (11.000 / 10.000 / 12.000), but the 4-digit delta 1000 is ungrouped in es.
    expect(
      screen.getByText('Último 11.000 kg · rango 10.000–12.000 kg · sube 1000 kg'),
    ).toBeOnTheScreen();
  });

  /**
   * UX-3D R-3…R-14 (`.ai/20_PROGRESS_NONVISUAL.md`). These assert STRUCTURE —
   * resolved labels, visible text and the absence of accessible ancestors in a
   * test renderer. No VoiceOver, TalkBack, browser-AT, large-text or
   * physical-device outcome is claimed by any of them; that is the unrun UX-4C
   * manual pass.
   */
  describe('non-visual equivalent (UX-3D)', () => {
    it('begins every point label with its own series title (R-3)', async () => {
      await render(
        <TrendBars title="Body weight" data={points([80, 81, 82])} unit=" kg" testID="t" />,
      );

      const labels = barLabels('t');
      expect(labels).toHaveLength(3);
      expect(labels.every((label) => label.startsWith('Body weight, '))).toBe(true);
    });

    it('keeps two charts sharing a date and value distinguishable by title alone (R-3)', async () => {
      // Identical points in both series: without the title prefix the two
      // charts would announce byte-identical labels.
      await render(
        <>
          <TrendBars title="Body weight" data={points([80, 81])} unit=" kg" testID="w" />
          <TrendBars title="Muscle mass" data={points([80, 81])} unit=" kg" testID="m" />
        </>,
      );

      expect(screen.getByLabelText('Body weight, 2026-08-01: 80 kg')).toBeOnTheScreen();
      expect(screen.getByLabelText('Muscle mass, 2026-08-01: 80 kg')).toBeOnTheScreen();
      // Two labels share the date/value pair; the title is what separates them,
      // and the untitled form is gone rather than merely supplemented.
      expect(screen.getAllByLabelText(/2026-08-01: 80 kg/)).toHaveLength(2);
      expect(screen.queryAllByLabelText('2026-08-01: 80 kg')).toHaveLength(0);
    });

    it('marks the latest point in text and no other point (R-4)', async () => {
      await render(<TrendBars title="V" data={points([80, 81, 82])} unit=" kg" testID="t" />);

      const labels = barLabels('t');
      expect(labels).toHaveLength(3);
      expect(labels.filter((label) => label.endsWith(' · latest'))).toEqual([
        'V, 2026-08-03: 82 kg · latest',
      ]);
    });

    it('marks the latest point in Spanish with feminine agreement (R-4)', async () => {
      mockLanguage = 'es';
      await render(<TrendBars title="Peso" data={points([80, 81, 82])} unit=" kg" testID="t" />);

      // "última" agrees with *lectura*; it is appended after a separator, so it
      // stays lower-case (`.ai/19_COPY_DECKS.md` §Progress copy notes).
      expect(screen.getByLabelText('Peso, 2026-08-03: 82 kg · última')).toBeOnTheScreen();
      expect(barLabels('t').filter((label) => label.includes('última'))).toHaveLength(1);
    });

    it('renders a visible descriptor naming the series, shown count and order (R-5)', async () => {
      await render(
        <TrendBars title="Body weight" data={points([80, 81, 82])} unit=" kg" testID="t" />,
      );

      // Visible text, not an accessibility-only affordance.
      expect(screen.getByText('Body weight · 3 readings · oldest to newest')).toBeOnTheScreen();
      expect(screen.getByTestId('t-descriptor')).toHaveTextContent(
        'Body weight · 3 readings · oldest to newest',
      );
    });

    it('renders the descriptor in Spanish (R-5)', async () => {
      mockLanguage = 'es';
      await render(
        <TrendBars title="Peso corporal" data={points([80, 81, 82])} unit=" kg" testID="t" />,
      );

      expect(
        screen.getByText('Peso corporal · 3 lecturas · de la más antigua a la más reciente'),
      ).toBeOnTheScreen();
    });

    it('counts only the SHOWN points in the descriptor, not the whole series (R-5)', async () => {
      const many = Array.from({ length: 15 }, (_, i) => ({ label: `d${i}`, value: i }));
      await render(<TrendBars title="V" data={many} unit="" maxBars={12} testID="t" />);

      expect(screen.getByText('V · 12 readings · oldest to newest')).toBeOnTheScreen();
      // The descriptor never invents a total, and never says "12 of 15".
      expect(screen.queryByText(/15/)).toBeNull();
    });

    it('renders the window notice only when the series is truncated (R-6)', async () => {
      const many = Array.from({ length: 15 }, (_, i) => ({ label: `d${i}`, value: i }));
      const { rerender } = await render(
        <TrendBars title="V" data={many} unit="" maxBars={12} testID="t" />,
      );

      // Truncated: visible notice, reached as ordinary text.
      expect(screen.getByText('Showing only the most recent readings')).toBeOnTheScreen();
      expect(screen.getByTestId('t-window-notice')).toBeOnTheScreen();

      // Complete series: an unqualified summary stays unqualified.
      await rerender(
        <TrendBars title="V" data={many.slice(0, 12)} unit="" maxBars={12} testID="t" />,
      );
      expect(screen.queryByText('Showing only the most recent readings')).toBeNull();
      expect(screen.queryByTestId('t-window-notice')).toBeNull();
    });

    it('renders the window notice in Spanish (R-6)', async () => {
      mockLanguage = 'es';
      const many = Array.from({ length: 13 }, (_, i) => ({ label: `d${i}`, value: i }));
      await render(<TrendBars title="V" data={many} unit="" maxBars={12} testID="t" />);

      expect(screen.getByText('Mostrando solo las lecturas más recientes')).toBeOnTheScreen();
    });

    it('renders neither descriptor nor window notice below two points (R-7)', async () => {
      const { rerender } = await render(
        <TrendBars title="Body weight" data={[]} unit=" kg" testID="t" />,
      );

      // 0 points: the shipped noData text stands alone.
      expect(screen.getByText('No data yet.')).toBeOnTheScreen();
      expect(screen.queryByTestId('t-descriptor')).toBeNull();
      expect(screen.queryByTestId('t-window-notice')).toBeNull();
      expect(screen.queryByText(/readings/)).toBeNull();
      expect(screen.queryByText(/oldest to newest/)).toBeNull();
      expect(screen.queryByTestId('t-bars')).toBeNull();

      // 1 point: the shipped oneReading text stands alone, with no count and no
      // trend claim — and `maxBars` truncation cannot resurrect the notice.
      await rerender(
        <TrendBars
          title="Body weight"
          data={points([80, 81, 82])}
          unit=" kg"
          maxBars={1}
          testID="t"
        />,
      );
      expect(screen.getByText('1 reading: 82 kg')).toBeOnTheScreen();
      expect(screen.queryByTestId('t-descriptor')).toBeNull();
      expect(screen.queryByTestId('t-window-notice')).toBeNull();
      expect(screen.queryByTestId('t-bars')).toBeNull();
    });

    it('renders neither descriptor nor window notice below two points in Spanish (R-7)', async () => {
      mockLanguage = 'es';
      const { rerender } = await render(<TrendBars title="Peso" data={[]} unit=" kg" testID="t" />);

      expect(screen.getByText('Sin datos aún.')).toBeOnTheScreen();
      expect(screen.queryByText(/lecturas/)).toBeNull();
      expect(screen.queryByText(/de la más antigua/)).toBeNull();
      expect(screen.queryByText('Mostrando solo las lecturas más recientes')).toBeNull();

      await rerender(<TrendBars title="Peso" data={points([80])} unit=" kg" testID="t" />);
      expect(screen.getByText('1 lectura: 80 kg')).toBeOnTheScreen();
      expect(screen.queryByTestId('t-descriptor')).toBeNull();
      expect(screen.queryByTestId('t-window-notice')).toBeNull();
    });

    it('renders points oldest → newest in the rendered tree (R-8)', async () => {
      await render(<TrendBars title="V" data={points([80, 81, 82])} unit=" kg" testID="t" />);

      // Document order IS the reading and focus order, so this is what the
      // descriptor's "oldest to newest" claim must match.
      expect(barLabels('t')).toEqual([
        'V, 2026-08-01: 80 kg',
        'V, 2026-08-02: 81 kg',
        'V, 2026-08-03: 82 kg · latest',
      ]);
    });

    it('preserves flat-series behaviour: bars render and direction stays flat (R-9)', async () => {
      await render(<TrendBars title="V" data={points([80, 80, 80])} unit=" kg" testID="t" />);

      // range === 0 → frac = 1 → full-height bars, no division by zero.
      expect(bars('t')).toHaveLength(3);
      expect(screen.getByText('Latest 80 kg · range 80–80 kg · flat 0 kg')).toBeOnTheScreen();
      // The equal-value series is still a series: it keeps its descriptor.
      expect(screen.getByText('V · 3 readings · oldest to newest')).toBeOnTheScreen();
      expect(screen.getByLabelText('V, 2026-08-03: 80 kg · latest')).toBeOnTheScreen();
    });

    it('lets no container swallow a bar: root and bar row are not accessible (R-12)', async () => {
      await render(<TrendBars title="V" data={points([80, 81, 82])} unit=" kg" testID="t" />);

      const root = screen.getByTestId('t');
      const barRow = screen.getByTestId('t-bars');
      for (const container of [root, barRow]) {
        expect(container.props.accessible).toBeFalsy();
        expect(container.props.accessibilityLabel).toBeUndefined();
      }

      // Each bar is its own accessible leaf, with NO accessible ancestor
      // anywhere above it — the pattern React Native documents as unreliable.
      const leaves = bars('t');
      expect(leaves).toHaveLength(3);
      for (const leaf of leaves) {
        expect(leaf.props.accessible).toBe(true);
        expect(String(leaf.props.accessibilityLabel).length).toBeGreaterThan(0);
        expect(accessibleAncestors(leaf)).toEqual([]);
      }
    });

    it('introduces no live region and no imperative announcement (R-13)', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      const many = Array.from({ length: 15 }, (_, i) => ({ label: `d${i}`, value: i }));
      const { rerender } = await render(
        <TrendBars title="V" data={many} unit="" maxBars={12} testID="t" />,
      );

      // Re-render with changed data: a live region here would make every
      // progress edit speak, and the codebase deliberately has none.
      await rerender(
        <TrendBars title="V" data={many.slice(0, 13)} unit="" maxBars={12} testID="t" />,
      );

      const rendered = screen.container.queryAll(() => true);
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.filter((node) => node.props.accessibilityLiveRegion !== undefined)).toEqual(
        [],
      );
      expect(announce).not.toHaveBeenCalled();
      announce.mockRestore();
    });

    it('never reads a store, repository or SQLite (R-14)', async () => {
      await render(<TrendBars title="V" data={points([80, 81, 82])} unit=" kg" testID="t" />);

      // It rendered from its props alone…
      expect(bars('t')).toHaveLength(3);
      // …and touched neither the store nor the persistence layer.
      expect(jest.mocked(useProgressStore)).not.toHaveBeenCalled();
      expect(jest.mocked(inTransaction)).not.toHaveBeenCalled();
      expect(jest.mocked(queryAll)).not.toHaveBeenCalled();
      expect(jest.mocked(queryFirst)).not.toHaveBeenCalled();
      expect(jest.mocked(run)).not.toHaveBeenCalled();
    });
  });
});
