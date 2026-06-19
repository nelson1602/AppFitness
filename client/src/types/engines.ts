// ─── Health ──────────────────────────────────────────────────────────────────

export interface ReadinessFactor {
  name:    string
  score:   number
  weight:  number
  message: string
}

export interface ReadinessScore {
  score:          number
  status:         'excellent' | 'good' | 'fair' | 'poor'
  factors:        ReadinessFactor[]
  recommendation: string
}

export interface HealthLog {
  id:            string
  date:          string
  sleepHours:    number | null
  sleepQuality:  number | null
  energyLevel:   number | null
  stressLevel:   number | null
  restingHR:     number | null
  mood:          number | null
  readinessScore: number | null
  notes:         string | null
}

// ─── Recommendation ──────────────────────────────────────────────────────────

export interface MacroTargets {
  calories: number
  proteinG: number
  carbsG:   number
  fatG:     number
}

export interface NutritionAdjustment {
  targets:   MacroTargets
  previous:  MacroTargets
  tdee:      number
  rationale: string[]
  changes:   { calories: number; protein: number; carbs: number; fat: number }
}

export interface TrainingAdjustment {
  recommendedFrequency: number
  volumeModifier:       number
  intensityModifier:    number
  isDeloadWeek:         boolean
  rationale:            string[]
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface GoalPrediction {
  canPredict:         boolean
  reason?:            string
  estimatedDate?:     string
  weeksRemaining?:    number
  weeklyRateKg?:      number
  confidencePercent?: number
  bestCase?:          string
  worstCase?:         string
}

export interface ProgressAnalysis {
  weightPlateau:        { detected: boolean; durationWeeks?: number; recommendation?: string }
  goalPrediction:       GoalPrediction
  deloadDecision:       { shouldDeload: boolean; reason?: string; urgency?: string }
  weeklyWeightChange:   number
  weeklyVolumeChange:   number
  adherenceRate:        number
  weeksSinceLastDeload: number
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface NotificationPayload {
  type:     string
  priority: string
  title:    string
  message:  string
  data?:    Record<string, unknown>
}

// ─── Workout / Routine ────────────────────────────────────────────────────────

export type SplitType = 'full_body' | 'upper_lower' | 'ppl'
export type DayFocus  = 'full_body' | 'upper' | 'lower' | 'push' | 'pull' | 'legs'

export interface GeneratedExercise {
  name:        string
  muscleGroup: string
  sets:        number
  reps:        string
  restSeconds: number
  isCompound:  boolean
  notes?:      string
}

export interface WorkoutDay {
  dayIndex:              number
  label:                 string
  focus:                 DayFocus
  exercises:             GeneratedExercise[]
  estimatedDurationMins: number
}

export interface RoutineRecommendation {
  splitType:       SplitType
  days:            WorkoutDay[]
  totalWeeklySets: number
  rationale:       string[]
}

// ─── Coach ───────────────────────────────────────────────────────────────────

export interface CoachReport {
  readiness:                ReadinessScore
  progressAnalysis:         ProgressAnalysis
  nutritionRecommendation:  NutritionAdjustment
  trainingRecommendation:   TrainingAdjustment
  routineRecommendation:    RoutineRecommendation
  notifications:            NotificationPayload[]
  summary:                  string
  xpEarned:                 number
}

// ─── Gamification ────────────────────────────────────────────────────────────

export interface Achievement {
  id:          string
  key:         string
  name:        string
  description: string
  icon:        string
  category:    string
  xpReward:    number
  unlocked:    boolean
  unlockedAt:  string | null
}

export interface XPProgress {
  level:     number
  levelName: string
  current:   number
  required:  number
  pct:       number
}

export interface UserStats {
  id:              string
  xp:              number
  level:           number
  totalXp:         number
  currentStreak:   number
  longestStreak:   number
  lastActivityDate: string | null
  workoutsLogged:  number
  mealsLogged:     number
  weightsLogged:   number
  prsSet:          number
}

export interface GamificationData {
  stats:        UserStats
  xpProgress:   XPProgress
  achievements: Achievement[]
}
