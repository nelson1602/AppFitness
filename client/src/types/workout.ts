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
  routine?: { id: string; name: string } | null
  sets: WorkoutSet[]
}
