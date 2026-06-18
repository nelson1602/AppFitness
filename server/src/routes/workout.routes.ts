import { Router } from 'express'
import * as c from '@/controllers/workout.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import {
  createRoutineSchema,
  updateRoutineSchema,
  setRoutineExercisesSchema,
  startWorkoutSchema,
  finishWorkoutSchema,
  logSetSchema,
  updateSetSchema,
} from '@/models/workout.model'

const router = Router()

router.use(authenticate)

router.get('/exercises',              c.getExercises)
router.get('/exercises/muscle-groups', c.getMuscleGroups)

router.get('/routines',              c.getRoutines)
router.post('/routines',             validate(createRoutineSchema),       c.createRoutine)
router.get('/routines/:id',          c.getRoutine)
router.put('/routines/:id',          validate(updateRoutineSchema),       c.updateRoutine)
router.delete('/routines/:id',       c.deleteRoutine)
router.put('/routines/:id/exercises', validate(setRoutineExercisesSchema), c.setRoutineExercises)

router.get('/logs',                  c.getLogs)
router.post('/logs',                 validate(startWorkoutSchema),        c.startWorkout)
router.get('/logs/:id',              c.getLog)
router.patch('/logs/:id/finish',     validate(finishWorkoutSchema),       c.finishWorkout)
router.delete('/logs/:id',           c.deleteLog)

router.post('/logs/:logId/sets',     validate(logSetSchema),             c.addSet)
router.patch('/sets/:id',            validate(updateSetSchema),           c.updateSet)
router.delete('/sets/:id',           c.deleteSet)

export default router
