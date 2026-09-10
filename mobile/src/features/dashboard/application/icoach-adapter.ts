import type { Goal } from '@/features/profile/domain/goal.types';
import type { Profile } from '@/features/profile/domain/profile.types';
import type { PhysicalAssessmentMetrics } from '@/features/progress';
import { evaluate } from '@/features/icoach/domain/engine';
// Cross-feature access goes through the public interfaces (.ai/06_MOBILE.md).
import { WellnessSafetyInputInvalid } from '@/features/icoach';
import type {
  ActivityLevel,
  EngineInput,
  FitnessLevel,
  GoalType,
  Sex,
} from '@/features/icoach/domain/types';
import type { WellnessConsumptionOutcome } from '@/features/wellness';

import type { DashboardAssessment, DataRequirement } from '../domain/dashboard.types';

/**
 * Everything the adapter reads. Exported so a caller — and the spec that
 * proves the boundary — can name the shape it must supply in full.
 */
export interface AdapterSources {
  profile: Profile | null;
  activeGoal: Goal | null;
  physicalAssessment: PhysicalAssessmentMetrics;
  today: string;
  /**
   * The wellness consumption read (ADR-P031 W-4C).
   *
   * **Required.** An optional field with an implicit `absent` fallback is
   * the same latent half-activation the routine preferences had: a caller
   * that forgot the read would build a plan that ignores the user’s
   * declarations and looks entirely normal. Every caller states the outcome
   * it actually observed. `EngineInput.wellness` stays optional, because an
   * explicit `absent` must still omit that key.
   */
  wellness: WellnessConsumptionOutcome;
}

export type AdapterResult =
  | { status: 'ready'; data: DashboardAssessment }
  | { status: 'incomplete'; missing: DataRequirement[]; notes: DataRequirement[] }
  /**
   * The wellness declaration could not be read or decoded (§Decision 8). It is
   * NOT `incomplete`: nothing is a missing prerequisite the user supplies
   * elsewhere, and it must never be shown as a plan that respects
   * declarations the app could not read. The surface renders the canonical
   * Error treatment.
   */
  | { status: 'unavailable' };

export function buildDashboardAssessment(sources: AdapterSources): AdapterResult {
  const missing: DataRequirement[] = [];
  const notes: DataRequirement[] = [];

  // Error precedence: an unreadable declaration outranks every other outcome,
  // including an incomplete profile. Reporting `incomplete` here would invite
  // the user to fill in prerequisites that would then produce a plan built
  // from limitations the app never managed to read.
  const wellness = sources.wellness;
  if (wellness.status === 'unavailable') return { status: 'unavailable' };

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
  if (!sources.physicalAssessment.weightKg) {
    missing.push({
      id: 'weight',
      title: 'Record a weight measurement',
      detail: 'Weight is required for body composition and nutrition targets.',
    });
  }

  // Advisory notes are computed BEFORE the blocking early return. They never
  // gate the assessment — a missing goal still falls back to MAINTENANCE — but
  // they must be reported even while blocking prerequisites are outstanding, so
  // a first-run surface can tell "goal not set yet" from "goal already chosen".
  // Computing them after the early return made them unreachable whenever the
  // dashboard was incomplete, which is exactly the first-run case.
  if (!sources.activeGoal) {
    notes.push({
      id: 'default-goal',
      title: 'Using maintenance goal',
      detail: 'Set a goal to personalize calorie and training adjustments.',
    });
  }
  if (!sources.profile?.gender) {
    notes.push({
      id: 'default-sex',
      title: 'Using undisclosed sex coefficients',
      detail: 'Add sex in your profile to improve BMR precision.',
    });
  }

  if (missing.length > 0) return { status: 'incomplete', missing, notes };

  const profile = sources.profile;
  const physicalAssessment = sources.physicalAssessment;
  if (!profile || !profile.birthDate || !profile.heightCm || !physicalAssessment.weightKg) {
    return { status: 'incomplete', missing, notes };
  }
  const age = calculateAge(profile.birthDate, sources.today);

  const input: EngineInput = {
    subject: {
      age,
      sex: mapSex(profile.gender),
      heightCm: profile.heightCm,
      weightKg: physicalAssessment.weightKg,
      bodyFatPct: physicalAssessment.bodyFatPct ?? undefined,
    },
    activityLevel: mapActivity(profile.activityLevel),
    goal: mapGoal(sources.activeGoal?.goalType),
    fitnessLevel: mapFitness(profile.fitnessLevel),
    // Public v1 uses wellness inputs only. The retained medical feature is
    // dormant and cannot feed iCoach until a future, separately approved slice.
    restrictions: [],
    // ADR-P031 W-4D: supplied ONLY from an `available` read. `absent` omits the
    // key entirely rather than passing an empty declaration, so "no profile"
    // and "declared nothing" stay distinguishable in the engine input.
    ...(wellness.status === 'available' ? { wellness: wellness.declaration } : {}),
    recovery: {
      sleepHours: profile.sleepHoursBaseline ?? undefined,
      stressLevel: profile.stressLevelBaseline ?? undefined,
    },
    trainingDaysPreference: profile.trainingDaysPerWeek,
  };

  // A declaration that reached here and still fails the engine's own
  // validation means the payload was malformed after W-2 accepted it. That is
  // the same class of failure as a refused read, so it takes the same outcome
  // instead of crashing the surface (§Decision 8). No other error is swallowed.
  let assessment;
  try {
    assessment = evaluate(input);
  } catch (error) {
    if (error instanceof WellnessSafetyInputInvalid) return { status: 'unavailable' };
    throw error;
  }

  return {
    status: 'ready',
    data: {
      assessment,
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
  if (goal === 'REHABILITATION') return 'GENERAL_HEALTH';
  return goal ?? 'MAINTENANCE';
}
