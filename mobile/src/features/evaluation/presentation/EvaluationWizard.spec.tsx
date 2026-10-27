import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Profile } from '@/features/profile/domain/profile.types';

import { loadEvaluationDraft, saveEvaluation } from '../application/evaluation.service';
import { useEvaluationStore } from '../application/evaluation.store';
import { draftFromSources, type EvaluationSources } from '../domain/evaluation';
import { EvaluationWizard } from './EvaluationWizard';

jest.mock('@/features/authentication', () => ({
  bindStoreToSession: jest.fn(),
  getSession: () => ({ user: { id: 'u1' } }),
  isSessionCurrent: () => true,
  requireSessionSnapshot: () => ({ userId: 'u1', accessToken: 't' }),
}));
jest.mock('../application/evaluation.service', () => ({
  ...jest.requireActual('../application/evaluation.service'),
  loadEvaluationDraft: jest.fn(),
  saveEvaluation: jest.fn(),
}));
jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  return {
    ...actual,
    useLocalization: () => ({ language: 'es', t: (key: string) => es[key] ?? key }),
  };
});

const TODAY = '2026-10-28';

function sourcesWith(profile: Partial<Profile> | null): EvaluationSources {
  return {
    profile: profile
      ? ({
          birthDate: '1990-01-15',
          gender: 'MALE',
          heightCm: 175,
          equipment: [],
          ...profile,
        } as Profile)
      : null,
    goal: null,
    weightKg: profile ? 80 : null,
    wellness: null,
    preferences: [],
    today: TODAY,
  };
}

function given(sources: EvaluationSources) {
  jest.mocked(loadEvaluationDraft).mockResolvedValue({
    sources,
    draft: draftFromSources(sources),
  });
}

beforeEach(() => {
  jest.mocked(saveEvaluation).mockReset().mockResolvedValue(undefined);
  useEvaluationStore.setState({ status: 'idle', draft: null, sources: null, saveFailed: false });
});

async function next() {
  await fireEvent.press(screen.getByTestId('evaluation-continue'));
}

describe('EvaluationWizard (first run)', () => {
  it('opens on Medidas, step 1 of 6, with no way back', async () => {
    given(sourcesWith(null));
    await render(<EvaluationWizard mode="first-run" onSaved={jest.fn()} />);
    expect(await screen.findByText('EVALUACIÓN FÍSICA · PASO 1 DE 6')).toBeTruthy();
    expect(screen.getByText('Medidas')).toBeTruthy();
    expect(screen.queryByTestId('evaluation-back')).toBeNull();
  });

  it('shows what is missing instead of continuing', async () => {
    given(sourcesWith(null));
    await render(<EvaluationWizard mode="first-run" onSaved={jest.fn()} />);
    await screen.findByTestId('evaluation-continue');
    await next();
    expect(screen.getByTestId('evaluation-weight-error')).toBeTruthy();
    expect(screen.getByTestId('evaluation-height-error')).toBeTruthy();
    expect(screen.getByText('Medidas')).toBeTruthy();
  });

  it('computes the BMI as the person types', async () => {
    given(sourcesWith(null));
    await render(<EvaluationWizard mode="first-run" onSaved={jest.fn()} />);
    await fireEvent.changeText(await screen.findByTestId('evaluation-weight'), '80');
    await fireEvent.changeText(screen.getByTestId('evaluation-height'), '175');
    expect(screen.getByTestId('evaluation-bmi-value')).toHaveTextContent('26,1');
    expect(screen.getByText('Sobrepeso')).toBeTruthy();
  });

  it('walks the six steps and generates the plan with the marked foods', async () => {
    given(sourcesWith({}));
    const onSaved = jest.fn();
    await render(<EvaluationWizard mode="first-run" onSaved={onSaved} />);
    await screen.findByTestId('evaluation-continue');
    await next(); // Medidas → Salud
    await fireEvent.press(screen.getByTestId('evaluation-injury-knee'));
    await next(); // → Alimentación
    await fireEvent.press(screen.getByTestId('evaluation-food-group-meat-toggle'));
    await fireEvent.press(screen.getByTestId('evaluation-food-egg'));
    expect(screen.getByTestId('evaluation-food-egg-allergy')).toHaveProp('accessibilityState', {
      checked: true,
      selected: true,
    });
    await fireEvent.press(screen.getByTestId('evaluation-food-egg-preference'));
    await next(); // → Estilo de vida
    await fireEvent.press(screen.getByTestId('evaluation-days-4'));
    await next(); // → Meta
    await next();
    expect(screen.getByTestId('evaluation-target-weight-error')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('evaluation-target-weight'), '75');
    await act(async () => useEvaluationStore.getState().update({ targetDate: '2027-03-01' }));
    await next(); // → Revisión
    expect(screen.getByText('Revisión')).toBeTruthy();
    expect(screen.getByTestId('evaluation-review-health')).toHaveTextContent(/Lesiones: Rodilla/);
    expect(screen.getByTestId('evaluation-review-food')).toHaveTextContent(/Excluir: Huevo/);
    expect(screen.getByTestId('evaluation-preview-kcal')).toHaveTextContent(/kcal al día/);
    expect(screen.getByText('Generar mi plan con iCoach')).toBeTruthy();

    await next();
    expect(saveEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        injuries: ['knee'],
        foods: { egg: 'preference' },
        trainingDays: 4,
        targetWeightKg: 75,
      }),
      expect.anything(),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('jumps back to a section from Revisión', async () => {
    given({ ...sourcesWith({}), goal: null });
    await render(<EvaluationWizard mode="first-run" onSaved={jest.fn()} />);
    await screen.findByTestId('evaluation-continue');
    await act(async () =>
      useEvaluationStore.getState().update({ targetWeightKg: 75, targetDate: '2027-03-01' }),
    );
    for (let i = 0; i < 5; i += 1) await next();
    await fireEvent.press(screen.getByTestId('evaluation-review-edit-lifestyle'));
    expect(screen.getByText('Estilo de vida')).toBeTruthy();
  });

  it('says so when saving fails and stays on Revisión', async () => {
    given(sourcesWith({}));
    jest.mocked(saveEvaluation).mockRejectedValue(new Error('sqlite'));
    const onSaved = jest.fn();
    await render(<EvaluationWizard mode="first-run" onSaved={onSaved} />);
    await screen.findByTestId('evaluation-continue');
    await act(async () =>
      useEvaluationStore.getState().update({ targetWeightKg: 75, targetDate: '2027-03-01' }),
    );
    for (let i = 0; i < 6; i += 1) await next();
    expect(screen.getByText('No pudimos guardar tu evaluación. Inténtalo de nuevo.')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('EvaluationWizard (Perfil → Actualizar evaluación)', () => {
  it('opens on the saved data and can be closed', async () => {
    given(sourcesWith({}));
    const onExit = jest.fn();
    await render(<EvaluationWizard mode="update" onExit={onExit} onSaved={jest.fn()} />);
    expect(await screen.findByText('ACTUALIZAR EVALUACIÓN · PASO 1 DE 6')).toBeTruthy();
    expect(screen.getByTestId('evaluation-weight')).toHaveProp('value', '80');
    await fireEvent.press(screen.getByTestId('evaluation-back'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
