export interface PlateauResult {
  detected:        boolean
  type?:           'weight' | 'strength'
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
  bestCase?:          string
  worstCase?:         string
}

export interface DeloadDecision {
  shouldDeload:         boolean
  reason?:              string
  urgency?:             'low' | 'medium' | 'high'
  weeksSinceLastDeload?: number
}

export interface ProgressAnalysis {
  weightPlateau:       PlateauResult
  goalPrediction:      GoalPrediction
  deloadDecision:      DeloadDecision
  weeklyWeightChange:  number
  weeklyVolumeChange:  number
  adherenceRate:       number
  weeksSinceLastDeload: number
}
