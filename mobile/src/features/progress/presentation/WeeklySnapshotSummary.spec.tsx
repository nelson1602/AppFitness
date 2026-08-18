import { render, screen } from '@testing-library/react-native';

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
    expect(screen.getByText('Earlier weeks')).toBeOnTheScreen();
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
    expect(screen.getByText('Semanas anteriores')).toBeOnTheScreen();
    // day 27 + 2026 (no UTC shift); 9000 is 4-digit → ungrouped in es; singular
    // "entrenamiento"; deload tag "descarga".
    expect(
      screen.getByText(/27\b.*2026: 9000 kg de volumen · 1 entrenamiento · descarga/),
    ).toBeOnTheScreen();
  });
});
