import api from '@/lib/axios'
import type { Exercise, Routine, WorkoutLog, WorkoutSet } from '@/types/workout'

export const fetchExercises = (params?: { search?: string; muscleGroup?: string }) =>
  api.get<Exercise[]>('/workouts/exercises', { params }).then((r) => r.data)

export const fetchMuscleGroups = () =>
  api.get<string[]>('/workouts/exercises/muscle-groups').then((r) => r.data)

export const fetchRoutines = () =>
  api.get<Routine[]>('/workouts/routines').then((r) => r.data)

export const fetchRoutine = (id: string) =>
  api.get<Routine>(`/workouts/routines/${id}`).then((r) => r.data)

export const createRoutine = (data: { name: string; description?: string }) =>
  api.post<Routine>('/workouts/routines', data).then((r) => r.data)

export const updateRoutine = (id: string, data: { name?: string; description?: string }) =>
  api.put<Routine>(`/workouts/routines/${id}`, data).then((r) => r.data)

export const deleteRoutine = (id: string) =>
  api.delete(`/workouts/routines/${id}`)

export const setRoutineExercises = (
  id: string,
  exercises: Array<{
    exerciseId: string
    order: number
    targetSets?: number | null
    targetReps?: number | null
    targetWeight?: number | null
  }>,
) =>
  api.put<Routine>(`/workouts/routines/${id}/exercises`, { exercises }).then((r) => r.data)

export const fetchLogs = (params?: { limit?: number; offset?: number }) =>
  api.get<WorkoutLog[]>('/workouts/logs', { params }).then((r) => r.data)

export const fetchLog = (id: string) =>
  api.get<WorkoutLog>(`/workouts/logs/${id}`).then((r) => r.data)

export const startWorkout = (data: { name: string; routineId?: string }) =>
  api.post<WorkoutLog>('/workouts/logs', data).then((r) => r.data)

export const finishWorkout = (id: string, notes?: string) =>
  api.patch<WorkoutLog>(`/workouts/logs/${id}/finish`, { notes }).then((r) => r.data)

export const deleteWorkoutLog = (id: string) =>
  api.delete(`/workouts/logs/${id}`)

export const addSet = (
  logId: string,
  data: { exerciseId: string; setNumber: number; reps?: number; weight?: number; rpe?: number; completed?: boolean },
) => api.post<WorkoutSet>(`/workouts/logs/${logId}/sets`, data).then((r) => r.data)

export const updateSet = (
  id: string,
  data: { reps?: number; weight?: number; rpe?: number; completed?: boolean; notes?: string },
) => api.patch<WorkoutSet>(`/workouts/sets/${id}`, data).then((r) => r.data)

export const deleteSet = (id: string) =>
  api.delete(`/workouts/sets/${id}`)
