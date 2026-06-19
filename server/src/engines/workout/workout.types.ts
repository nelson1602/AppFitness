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
