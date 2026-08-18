import { render, screen } from '@testing-library/react-native';

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

function points(values: number[]): TrendPoint[] {
  return values.map((v, i) => ({ label: `2026-08-0${i + 1}`, value: v }));
}

describe('TrendBars', () => {
  beforeEach(() => {
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
    expect(screen.getByLabelText('2026-08-01: 80 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('2026-08-02: 81 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('2026-08-03: 79.5 kg')).toBeOnTheScreen();
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
    expect(screen.getByLabelText('2026-08-01: 80 kg')).toBeOnTheScreen();
  });

  it('keeps only the most recent maxBars points', async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ label: `d${i}`, value: i }));
    await render(<TrendBars title="V" data={many} unit="" maxBars={12} testID="t" />);
    // Oldest three (d0–d2) are dropped; d3 is the first kept bar.
    expect(screen.queryByLabelText('d0: 0')).toBeNull();
    expect(screen.getByLabelText('d3: 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('d14: 14')).toBeOnTheScreen();
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
});
