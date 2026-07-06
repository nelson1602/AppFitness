import { render, screen } from '@testing-library/react-native';

import type { DashboardAssessment } from '../../domain/dashboard.types';
import { AssessmentSummaryCard } from './assessment-summary-card';

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
  it('renders nutrition and training summary from the iCoach assessment', async () => {
    await render(<AssessmentSummaryCard assessment={assessment} />);

    expect(screen.getByLabelText('Today assessment summary')).toBeOnTheScreen();
    expect(screen.getByText('2500 kcal')).toBeOnTheScreen();
    expect(screen.getByText('BMI 25.9 / overweight')).toBeOnTheScreen();
    expect(screen.getByText('164g')).toBeOnTheScreen();
    expect(screen.getByText('4x / MODERATE')).toBeOnTheScreen();
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
});
