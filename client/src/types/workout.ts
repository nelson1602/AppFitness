export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  category: string
  instructions?: string | null
}

export interface RoutineExercise {
  id: string
  order: number
  targetSets?: number | null
  targetReps?: number | null
  targetWeight?: number | null
  exercise: Exercise
}

export interface Routine {
  id: string
  name: string
  description?: string | null
  exercises: RoutineExercise[]
  createdAt: string
  updatedAt: string
}

export interface WorkoutSet {
  id: string
  setNumber: number
  reps?: number | null
  weight?: number | null
  rpe?: number | null
  completed: boolean
  notes?: string | null
  exerciseId: string
  exercise: Exercise
}

export interface WorkoutLog {
  id: string
  name: string
  notes?: string | null
  startedAt: string
  finishedAt?: string | null
  routine?: {
    id: string
    name: string
    exercises: { exerciseId: string; order: number }[]
  } | null
  sets: WorkoutSet[]
}

export interface UnlockedAchievement {
  key:      string
  name:     string
  icon:     string
  xpReward: number
}

export interface WorkoutSummary {
  durationMins:    number
  volumeKg:        number
  setsCompleted:   number
  prsSet:          number
  xpEarned:        number
  newAchievements: UnlockedAchievement[]
}

export interface LastPerformance {
  reps:   number | null
  weight: number | null
}

export interface ExerciseSession {
  date:          string
  workoutName:   string
  workoutLogId:  string
  maxWeightKg:   number
  bestReps:      number
  totalVolumeKg: number
  setCount:      number
}
