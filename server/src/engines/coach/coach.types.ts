import type { ReadinessScore }        from '../health/health.types'
import type { NutritionAdjustment, TrainingAdjustment } from '../recommendation/recommendation.types'
import type { ProgressAnalysis }       from '../progress/progress.types'
import type { NotificationPayload }    from '../notification/notification.types'

// ─── Context passed into the coach engine ────────────────────────────────────

export interface UserProfileData {
  primaryGoal:         string
  targetWeightKg:      number | null
  targetDate:          string | null
  fitnessLevel:        string
  activityLevel:       string
  gender:              string | null
  birthDate:           string | null
  heightCm:            number | null
  trainingDaysPerWeek: number
  sessionDurationMins: number
  equipment:           string[]
  targetCalories:      number | null
  targetProteinG:      number | null
  targetCarbsG:        number | null
  targetFatG:          number | null
}

export interface HealthLogData {
  sleepHours:    number | null
  sleepQuality:  number | null
  energyLevel:   number | null
  stressLevel:   number | null
  restingHR:     number | null
  mood:          number | null
}

export interface ProgressSnapshotData {
  weekStart:      string
  avgWeightKg:    number | null
  totalVolumeKg:  number | null
  avgCalories:    number | null
  workoutCount:   number
  isDeloadWeek:   boolean
}

export interface MacroTargetData {
  targetCalories: number | null
  targetProteinG: number | null
  targetCarbsG:   number | null
  targetFatG:     number | null
}

export interface UserStatsData {
  currentStreak:  number
  workoutsLogged: number
  prsSet:         number
}

export interface CoachContext {
  userId:               string
  profile:              UserProfileData
  currentWeightKg:      number
  recentWeights:        Array<{ date: string; weight: number }>
  recentCalories:       number
  recentProteinG:       number
  recentVolumeKg:       number
  avgVolumeKg:          number
  progressSnapshots:    ProgressSnapshotData[]
  latestHealthLog:      HealthLogData | null
  currentTargets:       MacroTargetData
  stats:                UserStatsData
  workoutCountThisWeek: number
  trainingDaysActual:   number
}

// ─── Output of the coach engine ──────────────────────────────────────────────

export interface CoachReport {
  readiness:                 ReadinessScore
  progressAnalysis:          ProgressAnalysis
  nutritionRecommendation:   NutritionAdjustment
  trainingRecommendation:    TrainingAdjustment
  notifications:             NotificationPayload[]
  summary:                   string
  xpEarned:                  number
}
