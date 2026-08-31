import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildDashboardAssessment } from '../../application/icoach-adapter';
import type { DataRequirement } from '../../domain/dashboard.types';
import { OnboardingChecklistCard } from './onboarding-checklist-card';

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

const gap = (id: string): DataRequirement => ({ id, title: id, detail: '' });

const ALL_GAPS = [
  gap('profile'),
  gap('birth-date'),
  gap('height'),
  gap('default-goal'),
  gap('weight'),
];

describe('OnboardingChecklistCard', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('lists every outstanding step on a first run with nothing recorded', async () => {
    await render(<OnboardingChecklistCard gaps={ALL_GAPS} />);

    expect(screen.getByText('Finish setting up AppFitness')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('0 of 3 complete');
    expect(screen.getAllByTestId(/^onboarding-step-/)).toHaveLength(3);
    expect(screen.getByTestId('onboarding-step-profile')).toHaveTextContent(
      'Add your profile basics',
    );
    expect(screen.getByTestId('onboarding-step-goal')).toHaveTextContent('Choose your goal');
    expect(screen.getByTestId('onboarding-step-weight')).toHaveTextContent(
      'Record your first weight',
    );
  });

  it('treats the three profile-side gaps as one step', async () => {
    await render(
      <OnboardingChecklistCard gaps={[gap('profile'), gap('birth-date'), gap('height')]} />,
    );

    expect(screen.getAllByTestId(/^onboarding-step-/)).toHaveLength(1);
    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('2 of 3 complete');
  });

  it('drops a resolved step and counts it as complete', async () => {
    await render(<OnboardingChecklistCard gaps={[gap('weight')]} />);

    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('2 of 3 complete');
    expect(screen.queryByTestId('onboarding-step-profile')).toBeNull();
    expect(screen.queryByTestId('onboarding-step-goal')).toBeNull();
    expect(screen.getByTestId('onboarding-step-weight')).toBeOnTheScreen();
  });

  it('reports full completion when no gap remains', async () => {
    await render(<OnboardingChecklistCard gaps={[]} />);

    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('3 of 3 complete');
    expect(screen.queryAllByTestId(/^onboarding-step-/)).toHaveLength(0);
  });

  it('routes a step through the caller-supplied resolver, never its own routing', async () => {
    const fix = jest.fn();
    const resolveFix = jest.fn((requirement: DataRequirement) =>
      requirement.id === 'weight' ? fix : undefined,
    );

    await render(<OnboardingChecklistCard gaps={[gap('weight')]} resolveFix={resolveFix} />);
    fireEvent.press(screen.getByTestId('gap-fix-weight'));

    expect(resolveFix).toHaveBeenCalledWith(expect.objectContaining({ id: 'weight' }));
    expect(fix).toHaveBeenCalledTimes(1);
  });

  it('renders no action for a step the resolver cannot address', async () => {
    await render(<OnboardingChecklistCard gaps={[gap('weight')]} resolveFix={() => undefined} />);

    expect(screen.getByTestId('onboarding-step-weight')).toBeOnTheScreen();
    expect(screen.queryByTestId('gap-fix-weight')).toBeNull();
  });

  it('shows all three steps on a real first-run account, driven by adapter output', async () => {
    // Real production output, not hand-built screen state: a brand-new account
    // has no profile, no goal and no weight.
    const adapter = buildDashboardAssessment({
      profile: null,
      activeGoal: null,
      physicalAssessment: { weightKg: null, bodyFatPct: null },
      today: '2026-07-06',
    });
    if (adapter.status !== 'incomplete') throw new Error('expected an incomplete first run');
    const outstanding = [...adapter.missing, ...adapter.notes];

    await render(<OnboardingChecklistCard gaps={outstanding} />);

    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('0 of 3 complete');
    expect(screen.getAllByTestId(/^onboarding-step-/)).toHaveLength(3);
    expect(screen.getByTestId('onboarding-step-goal')).toBeOnTheScreen();
  });

  it('never turns the default-sex note into a checklist step', async () => {
    const adapter = buildDashboardAssessment({
      profile: null,
      activeGoal: null,
      physicalAssessment: { weightKg: null, bodyFatPct: null },
      today: '2026-07-06',
    });
    if (adapter.status !== 'incomplete') throw new Error('expected an incomplete first run');

    expect(adapter.notes.map((item) => item.id)).toContain('default-sex');

    await render(<OnboardingChecklistCard gaps={[...adapter.missing, ...adapter.notes]} />);

    // default-sex has no entry screen in resolveGapFix, so it stays a
    // ready-branch note and never becomes a fourth step here.
    expect(screen.queryByTestId('onboarding-step-default-sex')).toBeNull();
    expect(screen.getAllByTestId(/^onboarding-step-/)).toHaveLength(3);
  });

  it('exposes no dismiss, skip or blocking control', async () => {
    await render(<OnboardingChecklistCard gaps={ALL_GAPS} resolveFix={() => jest.fn()} />);

    // Every button is a per-step fix action; ADR-P027 leaves dismissal undecided.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.props.accessibilityLabel).toMatch(/^Fix: /);
    }
  });

  it('renders Spanish copy and Spanish counts', async () => {
    mockLanguage = 'es';

    await render(<OnboardingChecklistCard gaps={[gap('default-goal'), gap('weight')]} />);

    expect(screen.getByText('Termina de configurar AppFitness')).toBeOnTheScreen();
    expect(
      screen.getByText('Completa estos pasos a tu ritmo. Ya puedes usar el resto de la app.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-progress')).toHaveTextContent('1 de 3 completados');
    expect(screen.getByTestId('onboarding-step-goal')).toHaveTextContent('Elige tu objetivo');
    expect(screen.getByTestId('onboarding-step-weight')).toHaveTextContent(
      'Registra tu primer peso',
    );
  });

  it('leaves no unreplaced placeholder in either language', async () => {
    for (const language of ['en', 'es'] as const) {
      mockLanguage = language;
      const view = await render(<OnboardingChecklistCard gaps={[gap('weight')]} />);
      expect(view.getByTestId('onboarding-progress')).not.toHaveTextContent('{completed}');
      expect(view.getByTestId('onboarding-progress')).not.toHaveTextContent('{total}');
      view.unmount();
    }
  });
});
