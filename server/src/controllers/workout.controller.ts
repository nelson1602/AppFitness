import { Request, Response, NextFunction } from 'express'
import * as svc from '@/services/workout.service'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export const getExercises = wrap(async (req, res) => {
  const data = await svc.getExercises(
    req.query.search as string | undefined,
    req.query.muscleGroup as string | undefined,
  )
  res.json(data)
})

export const getMuscleGroups = wrap(async (_req, res) => {
  res.json(await svc.getMuscleGroups())
})

export const getRoutines = wrap(async (req, res) => {
  res.json(await svc.getUserRoutines(req.userId))
})

export const createRoutine = wrap(async (req, res) => {
  res.status(201).json(await svc.createRoutine(req.userId, req.body))
})

export const getRoutine = wrap(async (req, res) => {
  res.json(await svc.getRoutineById(req.params.id, req.userId))
})

export const updateRoutine = wrap(async (req, res) => {
  res.json(await svc.updateRoutine(req.params.id, req.userId, req.body))
})

export const deleteRoutine = wrap(async (req, res) => {
  await svc.deleteRoutine(req.params.id, req.userId)
  res.status(204).send()
})

export const setRoutineExercises = wrap(async (req, res) => {
  res.json(await svc.setRoutineExercises(req.params.id, req.userId, req.body))
})

export const getLogs = wrap(async (req, res) => {
  const limit = Number(req.query.limit) || 20
  const offset = Number(req.query.offset) || 0
  res.json(await svc.getUserLogs(req.userId, limit, offset))
})

export const startWorkout = wrap(async (req, res) => {
  res.status(201).json(await svc.startWorkout(req.userId, req.body))
})

export const getLog = wrap(async (req, res) => {
  res.json(await svc.getWorkoutLogById(req.params.id, req.userId))
})

export const finishWorkout = wrap(async (req, res) => {
  res.json(await svc.finishWorkout(req.params.id, req.userId, req.body.notes))
})

export const deleteLog = wrap(async (req, res) => {
  await svc.deleteWorkoutLog(req.params.id, req.userId)
  res.status(204).send()
})

export const addSet = wrap(async (req, res) => {
  res.status(201).json(await svc.addSet(req.params.logId, req.userId, req.body))
})

export const updateSet = wrap(async (req, res) => {
  res.json(await svc.updateSet(req.params.id, req.userId, req.body))
})

export const deleteSet = wrap(async (req, res) => {
  await svc.deleteSet(req.params.id, req.userId)
  res.status(204).send()
})
