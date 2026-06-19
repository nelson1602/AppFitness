export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machines'
  | 'cables'
  | 'bodyweight'
  | 'kettlebell'
  | 'resistance_bands'

import type { DayFocus } from './workout.types'

export interface CatalogExercise {
  name:          string
  muscleGroup:   string
  category:      string
  equipment:     Equipment[]
  isCompound:    boolean
  fits:          DayFocus[]
  avoidIf:       string[]   // substring matches against injuries text
}

// Exercise names that exist in the DB seed use their exact seed names.
// All others are upserted on apply.
export const CATALOG: CatalogExercise[] = [
  // ── CHEST compounds ──────────────────────────────────────────────────────────
  {
    name: 'Bench Press', muscleGroup: 'Chest', category: 'strength',
    equipment: ['barbell'], isCompound: true,
    fits: ['push', 'upper', 'full_body'],
    avoidIf: ['shoulder', 'pec tear', 'chest'],
  },
  {
    name: 'Incline Bench Press', muscleGroup: 'Chest', category: 'strength',
    equipment: ['barbell'], isCompound: true,
    fits: ['push', 'upper', 'full_body'],
    avoidIf: ['shoulder'],
  },
  {
    name: 'Dumbbell Press', muscleGroup: 'Chest', category: 'strength',
    equipment: ['dumbbell'], isCompound: true,
    fits: ['push', 'upper', 'full_body'],
    avoidIf: ['shoulder'],
  },
  {
    name: 'Push-Up', muscleGroup: 'Chest', category: 'bodyweight',
    equipment: ['bodyweight'], isCompound: true,
    fits: ['push', 'upper', 'full_body'],
    avoidIf: ['wrist'],
  },
  // ── CHEST isolation ──────────────────────────────────────────────────────────
  {
    name: 'Dumbbell Fly', muscleGroup: 'Chest', category: 'strength',
    equipment: ['dumbbell'], isCompound: false,
    fits: ['push', 'upper'],
    avoidIf: ['shoulder', 'pec'],
  },
  // ── SHOULDER compounds ───────────────────────────────────────────────────────
  {
    name: 'Overhead Press', muscleGroup: 'Shoulders', category: 'strength',
    equipment: ['barbell', 'dumbbell'], isCompound: true,
    fits: ['push', 'upper', 'full_body'],
    avoidIf: ['shoulder', 'neck', 'rotator'],
  },
  // ── SHOULDER isolation ───────────────────────────────────────────────────────
  {
    name: 'Lateral Raise', muscleGroup: 'Shoulders', category: 'strength',
    equipment: ['dumbbell', 'cables', 'resistance_bands'], isCompound: false,
    fits: ['push', 'upper', 'full_body'],
    avoidIf: ['shoulder', 'rotator'],
  },
  {
    name: 'Face Pull', muscleGroup: 'Shoulders', category: 'strength',
    equipment: ['cables', 'resistance_bands'], isCompound: false,
    fits: ['pull', 'upper', 'full_body'],
    avoidIf: ['shoulder', 'rotator'],
  },
  // ── TRICEPS isolation ─────────────────────────────────────────────────────────
  {
    name: 'Tricep Pushdown', muscleGroup: 'Triceps', category: 'strength',
    equipment: ['cables'], isCompound: false,
    fits: ['push', 'upper'],
    avoidIf: ['elbow'],
  },
  {
    name: 'Skull Crusher', muscleGroup: 'Triceps', category: 'strength',
    equipment: ['barbell', 'dumbbell'], isCompound: false,
    fits: ['push', 'upper'],
    avoidIf: ['elbow', 'wrist'],
  },
  {
    name: 'Tricep Dip', muscleGroup: 'Triceps', category: 'bodyweight',
    equipment: ['bodyweight'], isCompound: false,
    fits: ['push', 'upper'],
    avoidIf: ['shoulder', 'elbow'],
  },
  // ── BACK compounds ───────────────────────────────────────────────────────────
  {
    name: 'Pull-Up', muscleGroup: 'Back', category: 'bodyweight',
    equipment: ['bodyweight'], isCompound: true,
    fits: ['pull', 'upper', 'full_body'],
    avoidIf: ['shoulder', 'elbow'],
  },
  {
    name: 'Barbell Row', muscleGroup: 'Back', category: 'strength',
    equipment: ['barbell'], isCompound: true,
    fits: ['pull', 'upper', 'full_body'],
    avoidIf: ['back', 'spine', 'lumbar', 'disc', 'herniat'],
  },
  {
    name: 'Dumbbell Row', muscleGroup: 'Back', category: 'strength',
    equipment: ['dumbbell'], isCompound: true,
    fits: ['pull', 'upper', 'full_body'],
    avoidIf: ['wrist'],
  },
  {
    name: 'Lat Pulldown', muscleGroup: 'Back', category: 'strength',
    equipment: ['machines', 'cables'], isCompound: true,
    fits: ['pull', 'upper', 'full_body'],
    avoidIf: ['shoulder'],
  },
  {
    name: 'Seated Cable Row', muscleGroup: 'Back', category: 'strength',
    equipment: ['cables', 'machines'], isCompound: true,
    fits: ['pull', 'upper', 'full_body'],
    avoidIf: ['back', 'lumbar'],
  },
  // ── BICEPS isolation ──────────────────────────────────────────────────────────
  {
    name: 'Barbell Curl', muscleGroup: 'Biceps', category: 'strength',
    equipment: ['barbell'], isCompound: false,
    fits: ['pull', 'upper'],
    avoidIf: ['elbow', 'wrist'],
  },
  {
    name: 'Hammer Curl', muscleGroup: 'Biceps', category: 'strength',
    equipment: ['dumbbell'], isCompound: false,
    fits: ['pull', 'upper'],
    avoidIf: ['elbow'],
  },
  // ── QUAD compounds ────────────────────────────────────────────────────────────
  {
    name: 'Squat', muscleGroup: 'Quads', category: 'strength',
    equipment: ['barbell'], isCompound: true,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['knee', 'hip', 'spine', 'lumbar', 'disc'],
  },
  {
    name: 'Goblet Squat', muscleGroup: 'Quads', category: 'strength',
    equipment: ['dumbbell', 'kettlebell'], isCompound: true,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['knee'],
  },
  {
    name: 'Bodyweight Squat', muscleGroup: 'Quads', category: 'bodyweight',
    equipment: ['bodyweight'], isCompound: true,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['knee'],
  },
  {
    name: 'Leg Press', muscleGroup: 'Quads', category: 'strength',
    equipment: ['machines'], isCompound: true,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['knee', 'hip'],
  },
  {
    name: 'Lunge', muscleGroup: 'Quads', category: 'bodyweight',
    equipment: ['bodyweight', 'dumbbell'], isCompound: true,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['knee', 'ankle'],
  },
  // ── HAMSTRING / GLUTE compounds ───────────────────────────────────────────────
  {
    name: 'Deadlift', muscleGroup: 'Back', category: 'strength',
    equipment: ['barbell'], isCompound: true,
    fits: ['legs', 'lower', 'pull', 'full_body'],
    avoidIf: ['back', 'spine', 'lumbar', 'disc', 'herniat', 'hip'],
  },
  {
    name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', category: 'strength',
    equipment: ['barbell', 'dumbbell'], isCompound: true,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['back', 'lumbar', 'hamstring', 'hip'],
  },
  {
    name: 'Hip Thrust', muscleGroup: 'Glutes', category: 'strength',
    equipment: ['barbell', 'dumbbell', 'bodyweight'], isCompound: true,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['hip', 'knee'],
  },
  {
    name: 'Glute Bridge', muscleGroup: 'Glutes', category: 'bodyweight',
    equipment: ['bodyweight'], isCompound: true,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['hip'],
  },
  {
    name: 'Kettlebell Swing', muscleGroup: 'Hamstrings', category: 'strength',
    equipment: ['kettlebell'], isCompound: true,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['back', 'hip', 'shoulder'],
  },
  // ── LEG isolation ─────────────────────────────────────────────────────────────
  {
    name: 'Leg Curl', muscleGroup: 'Hamstrings', category: 'strength',
    equipment: ['machines'], isCompound: false,
    fits: ['legs', 'lower'],
    avoidIf: ['knee', 'hamstring'],
  },
  {
    name: 'Calf Raise', muscleGroup: 'Calves', category: 'strength',
    equipment: ['bodyweight', 'barbell', 'machines'], isCompound: false,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['ankle', 'achilles'],
  },
  // ── CORE ─────────────────────────────────────────────────────────────────────
  {
    name: 'Plank', muscleGroup: 'Core', category: 'bodyweight',
    equipment: ['bodyweight'], isCompound: false,
    fits: ['legs', 'lower', 'full_body', 'push', 'pull', 'upper'],
    avoidIf: ['wrist', 'shoulder'],
  },
  {
    name: 'Dead Bug', muscleGroup: 'Core', category: 'bodyweight',
    equipment: ['bodyweight'], isCompound: false,
    fits: ['legs', 'lower', 'full_body'],
    avoidIf: ['back'],
  },
  {
    name: 'Cable Crunch', muscleGroup: 'Core', category: 'strength',
    equipment: ['cables'], isCompound: false,
    fits: ['legs', 'lower', 'full_body', 'push', 'pull'],
    avoidIf: ['back', 'spine'],
  },
]
