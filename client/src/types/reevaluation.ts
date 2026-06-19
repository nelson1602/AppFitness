export interface ReevaluationStatus {
  due:      boolean
  daysUntil: number
  overdue:  boolean
}

export interface ReevaluationResult {
  tdee:       number
  calories:   number
  proteinG:   number
  carbsG:     number
  fatG:       number
  weightUsed: number
}
