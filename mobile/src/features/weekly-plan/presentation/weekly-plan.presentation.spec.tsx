import { fireEvent, render, screen } from '@testing-library/react-native';

import type { PastWeek } from '../application/weekly-plan.service';
import type { WeekAdherence } from '../domain/adherence';
import { PastWeeksPanel } from './PastWeeksPanel';
import { PlanChangePrompt } from './PlanChangePrompt';

const mockConfirm = jest.fn().mockResolvedValue(true);
const mockDismiss = jest.fn();
let mockPending: string[] = [];
let mockCurrent: unknown = null;

jest.mock('../application/weekly-plan.store', () => ({
  useWeeklyPlanStore: (select: (state: Record<string, unknown>) => unknown) =>
    select({
      pendingChanges: mockPending,
      current: mockCurrent,
      confirmRegenerate: mockConfirm,
      dismissChanges: mockDismiss,
    }),
}));
jest.mock('@/shared/localization', () => {
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  const format = jest.requireActual('@/shared/localization/format');
  return {
    formatNumber: format.formatNumber,
    formatQuantity: format.formatQuantity,
    formatDate: format.formatDate,
    interpolate: format.interpolate,
    useLocalization: () => ({ language: 'es', t: (key: string) => es[key] ?? key }),
  };
});

const adherence = (over: Partial<WeekAdherence> = {}): WeekAdherence => ({
  weekStart: '2026-10-19',
  sessions: [
    { date: '2026-10-19', sessionKey: 'session.full_body_1', focusKey: 'f', done: true },
    { date: '2026-10-21', sessionKey: 'session.full_body_2', focusKey: 'f', done: false },
    { date: '2026-10-23', sessionKey: 'session.full_body_3', focusKey: 'f', done: true },
  ],
  plannedSessions: 3,
  fulfilledSessions: 2,
  plannedMeals: 28,
  mealsDone: 21,
  mealPct: 75,
  daysInCalorieTarget: 4,
  averageDailyCalories: 2140,
  targetCalories: 2000,
  weightChangeKg: -0.4,
  score: 71,
  tone: 'good',
  ...over,
});

const week = (over: Partial<WeekAdherence> = {}): PastWeek => ({
  adherence: adherence(over),
  nextWeekNotes: [{ code: 'plan.progression.keep', params: { missed: 1 } }],
});

beforeEach(() => {
  mockConfirm.mockClear();
  mockDismiss.mockClear();
  mockPending = [];
});

describe('PastWeeksPanel (ADR-P042 D7)', () => {
  it('shows the empty state before the first week ends', async () => {
    await render(<PastWeeksPanel weeks={[]} />);
    expect(screen.getByTestId('past-weeks-empty')).toBeTruthy();
  });

  it('summarises each week as "X de Y entrenamientos · N % de las comidas"', async () => {
    await render(<PastWeeksPanel weeks={[week()]} />);
    expect(screen.getByText('2 de 3 entrenamientos · 75 % de las comidas')).toBeTruthy();
    expect(screen.getByText('71%', { includeHiddenElements: true })).toBeTruthy();
  });

  it('opens the detail with sessions, food, weight and the iCoach note', async () => {
    await render(<PastWeeksPanel weeks={[week()]} />);
    await fireEvent.press(screen.getByTestId('past-week-2026-10-19'));
    expect(screen.getByTestId('week-detail')).toBeTruthy();
    expect(screen.getByText('Buena semana')).toBeTruthy();
    expect(screen.getByTestId('week-session-2026-10-19-done')).toBeTruthy();
    expect(screen.getByTestId('week-session-2026-10-21-missed')).toBeTruthy();
    expect(screen.getByText('4 de 7')).toBeTruthy();
    expect(screen.getByTestId('week-icoach-note')).toHaveTextContent(/Te faltó 1 entrenamiento/);
    await fireEvent.press(screen.getByTestId('week-detail-close'));
    expect(screen.queryByTestId('week-detail')).toBeNull();
  });

  it('says so when there are not enough weigh-ins', async () => {
    await render(<PastWeeksPanel weeks={[week({ weightChangeKg: null })]} />);
    await fireEvent.press(screen.getByTestId('past-week-2026-10-19'));
    expect(screen.getByTestId('week-weight')).toHaveTextContent(
      'Sin pesajes suficientes para comparar.',
    );
  });
});

describe('PlanChangePrompt (ADR-P042 D3)', () => {
  it('renders nothing without pending changes', async () => {
    await render(<PlanChangePrompt />);
    expect(screen.queryByTestId('plan-change-prompt')).toBeNull();
  });

  it('names the changes and confirms or dismisses', async () => {
    mockPending = ['trainingDays', 'injuries'];
    await render(<PlanChangePrompt />);
    expect(
      screen.getByText(
        'Cambiaste tus días de entrenamiento, tus lesiones. Puedes rehacer el plan desde hoy o mantenerlo hasta el lunes.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('plan-change-confirm'));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('plan-change-dismiss'));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  // ADR-P040 D11: two strong weeks earned one more training day.
  it('offers one more training day with its number', async () => {
    mockPending = ['moreDays'];
    mockCurrent = {
      notes: [{ code: 'plan.days.proposal', params: { days: 4 } }],
      plan: { inputs: { trainingDays: 3 } },
    };
    await render(<PlanChangePrompt />);
    expect(screen.getByTestId('plan-change-more-days')).toHaveTextContent(
      /dos semanas seguidas. ¿Subimos a 4 entrenamientos por semana desde hoy?/,
    );
    expect(screen.queryByText(/^Cambiaste/)).toBeNull();
    await fireEvent.press(screen.getByTestId('plan-change-confirm'));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    mockCurrent = null;
  });
});
