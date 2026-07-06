import type { Goal } from '@/features/profile/domain/goal.types';
import type { Profile } from '@/features/profile/domain/profile.types';
import type { Evaluation, Restriction } from '@/features/medical/domain/medical.types';
import { evaluate } from '@/features/icoach/domain/engine';
import type {
  ActivityLevel,
  EngineInput,
  FitnessLevel,
  GoalType,
  RestrictionInput,
  RestrictionSeverity,
  RestrictionType,
  Sex,
} from '@/features/icoach/domain/types';

import type { DashboardAssessment, DataRequirement } from '../domain/dashboard.types';

interface AdapterSources {
  profile: Profile | null;
  activeGoal: Goal | null;
  latestEvaluation: Evaluation | null;
  activeRestrictions: Restriction[];
  today: string;
}

export type AdapterResult =
  | { status: 'ready'; data: DashboardAssessment }
  | { status: 'incomplete'; missing: DataRequirement[] };

export function buildDashboardAssessment(sources: AdapterSources): AdapterResult {
  const missing: DataRequirement[] = [];
  const notes: DataRequirement[] = [];

  if (!sources.profile) {
    missing.push({
      id: 'profile',
      title: 'Create your profile',
      detail: 'The dashboard needs your profile to calculate safe targets.',
    });
  }
  if (!sources.profile?.birthDate) {
    missing.push({
      id: 'birth-date',
      title: 'Add your birth date',
      detail: 'Age is required for BMR and safety checks.',
    });
  }
  if (!sources.profile?.heightCm) {
    missing.push({
      id: 'height',
      title: 'Add your height',
      detail: 'Height is required for BMI and calorie calculations.',
    });
  }
  if (!sources.latestEvaluation?.weightKg) {
    missing.push({
      id: 'weight',
      title: 'Record a weight measurement',
      detail: 'Weight is required for body composition and nutrition targets.',
    });
  }

  if (missing.length > 0) return { status: 'incomplete', missing };

  const profile = sources.profile;
  const evaluation = sources.latestEvaluation;
  if (!profile || !profile.birthDate || !profile.heightCm || !evaluation?.weightKg) {
    return { status: 'incomplete', missing };
  }
  const age = calculateAge(profile.birthDate, sources.today);

  if (!sources.activeGoal) {
    notes.push({
      id: 'default-goal',
      title: 'Using maintenance goal',
      detail: 'Set a goal to personalize calorie and training adjustments.',
    });
  }
  if (!profile.gender) {
    notes.push({
      id: 'default-sex',
      title: 'Using undisclosed sex coefficients',
      detail: 'Add sex in your profile to improve BMR precision.',
    });
  }

  const input: EngineInput = {
    subject: {
      age,
      sex: mapSex(profile.gender),
      heightCm: profile.heightCm,
      weightKg: evaluation.weightKg,
      bodyFatPct: evaluation.bodyFatPct ?? undefined,
    },
    activityLevel: mapActivity(profile.activityLevel),
    goal: mapGoal(sources.activeGoal?.goalType),
    fitnessLevel: mapFitness(profile.fitnessLevel),
    restrictions: sources.activeRestrictions.map(mapRestriction),
    bloodPressure:
      evaluation.bloodPressureSystolic && evaluation.bloodPressureDiastolic
        ? {
            systolic: evaluation.bloodPressureSystolic,
            diastolic: evaluation.bloodPressureDiastolic,
          }
        : undefined,
    recovery: {
      sleepHours: profile.sleepHoursBaseline ?? undefined,
      stressLevel: profile.stressLevelBaseline ?? undefined,
    },
    trainingDaysPreference: profile.trainingDaysPerWeek,
  };

  return {
    status: 'ready',
    data: {
      assessment: evaluate(input),
      engineInput: input,
      notes,
    },
  };
}

function calculateAge(birthDate: string, today: string): number {
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  const now = new Date(`${today}T00:00:00.000Z`);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthday =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthday) age -= 1;
  return age;
}

function mapSex(gender: Profile['gender']): Sex {
  if (gender === 'MALE' || gender === 'FEMALE' || gender === 'OTHER') return gender;
  return 'UNDISCLOSED';
}

function mapActivity(activity: Profile['activityLevel']): ActivityLevel {
  return activity ?? 'MODERATE';
}

function mapFitness(level: Profile['fitnessLevel']): FitnessLevel {
  return level ?? 'INTERMEDIATE';
}

function mapGoal(goal: Goal['goalType'] | undefined): GoalType {
  return goal ?? 'MAINTENANCE';
}

function mapRestriction(restriction: Restriction): RestrictionInput {
  return {
    type: restriction.type as RestrictionType,
    bodyArea: restriction.bodyArea,
    severity: restriction.severity as RestrictionSeverity | null,
  };
}
