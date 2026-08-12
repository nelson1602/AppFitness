import { render, screen } from '@testing-library/react-native';

import type { DashboardAssessment } from '../../domain/dashboard.types';
import { AssessmentSummaryCard } from './assessment-summary-card';

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

const assessment: DashboardAssessment = {
  engineInput: {
    subject: {
      age: 36,
      sex: 'MALE',
      heightCm: 178,
      weightKg: 82,
      bodyFatPct: 21,
    },
    activityLevel: 'MODERATE',
    goal: 'RECOMPOSITION',
    fitnessLevel: 'INTERMEDIATE',
    restrictions: [],
    trainingDaysPreference: 4,
  },
  notes: [],
  assessment: {
    ruleVersion: 'icoach-v1',
    bodyComposition: {
      bmi: 25.9,
      bmiCategory: 'OVERWEIGHT',
      leanBodyMassKg: 64.8,
      leanBodyMassMethod: 'BODY_FAT',
      bodyFatCategory: 'AVERAGE',
    },
    metabolics: {
      bmr: 1720,
      bmrMethod: 'KATCH_MCARDLE',
      activityMultiplier: 1.55,
      tdee: 2666,
    },
    nutrition: {
      calories: 2500,
      adjustmentPct: -6,
      proteinG: 164,
      carbsG: 280,
      fatG: 74,
      safetyFloorApplied: false,
    },
    training: {
      blocked: false,
      requiresMedicalClearance: false,
      intensity: 'MODERATE',
      rpeCap: 8,
      daysPerWeek: 4,
      excludedMovements: [],
    },
    recommendations: [],
  },
};

describe('AssessmentSummaryCard', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  it('renders nutrition and training summary from the iCoach assessment', async () => {
    await render(<AssessmentSummaryCard assessment={assessment} />);

    expect(screen.getByLabelText("Today's assessment summary")).toBeOnTheScreen();
    expect(screen.getByText('2,500 kcal')).toBeOnTheScreen();
    expect(screen.getByText('BMI 25.9 / overweight')).toBeOnTheScreen();
    expect(screen.getByText('164 g')).toBeOnTheScreen();
    expect(screen.getByText('4× / moderate')).toBeOnTheScreen();
  });

  it('shows blocked training when medical restrictions prevent training', async () => {
    await render(
      <AssessmentSummaryCard
        assessment={{
          ...assessment,
          assessment: {
            ...assessment.assessment,
            training: {
              ...assessment.assessment.training,
              blocked: true,
              requiresMedicalClearance: true,
            },
          },
        }}
      />,
    );

    expect(screen.getByText('Blocked')).toBeOnTheScreen();
  });

  it('localizes labels, enums and decimal formatting in Spanish', async () => {
    mockLanguage = 'es';

    await render(<AssessmentSummaryCard assessment={assessment} />);

    expect(screen.getByLabelText('Resumen de la evaluación de hoy')).toBeOnTheScreen();
    expect(screen.getByText('Evaluación de hoy')).toBeOnTheScreen();
    expect(screen.getByText('IMC 25,9 / sobrepeso')).toBeOnTheScreen();
    expect(screen.getByText('Proteína')).toBeOnTheScreen();
    expect(screen.getByText('4× / moderada')).toBeOnTheScreen();
  });
});
