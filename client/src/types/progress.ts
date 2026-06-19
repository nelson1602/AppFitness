export interface PlateauResult {
  detected:        boolean
  type?:           string
  durationWeeks?:  number
  recommendation?: string
}

export interface GoalPrediction {
  canPredict:         boolean
  reason?:            string
  estimatedDate?:     string
  weeksRemaining?:    number
  weeklyRateKg?:      number
  confidencePercent?: number
}

export interface DeloadDecision {
  shouldDeload: boolean
  reason?:      string
  urgency?:     string
}

export interface ProgressReport {
  weightPlateau:        PlateauResult
  goalPrediction:       GoalPrediction
  deloadDecision:       DeloadDecision
  weeklyWeightChange:   number
  weeklyVolumeChange:   number
  adherenceRate:        number
  weeksSinceLastDeload: number
  currentWeightKg:      number
  targetWeightKg:       number | null
  totalPRs:             number
  totalWorkouts:        number
  currentStreak:        number
  recentVolumeKg:       number
  avgVolumeKg:          number
  trainingDaysActual:   number
  trainingDaysTarget:   number
}

export interface Notification {
  type:     'achievement' | 'reminder' | 'insight' | 'warning' | 'motivation'
  priority: 'low' | 'medium' | 'high'
  title:    string
  message:  string
  data?:    Record<string, unknown>
}

export interface SupplementSuggestion {
  name:     string
  reason:   string
  timing:   string
  category: 'recovery' | 'performance' | 'health' | 'nutrition'
}

export interface SupplementReport {
  goal:        string
  suggestions: SupplementSuggestion[]
}
