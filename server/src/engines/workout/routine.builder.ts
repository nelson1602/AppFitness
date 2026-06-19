import { CATALOG, type CatalogExercise } from './exercise.catalog'
import type { SplitType, DayFocus, GeneratedExercise, WorkoutDay, RoutineRecommendation } from './workout.types'
import type { UserProfileData } from '../coach/coach.types'
import type { TrainingAdjustment } from '../recommendation/recommendation.types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DaySlot {
  muscles:        string[]
  preferCompound: boolean
}

interface ExerciseScheme {
  reps:        string
  restSeconds: number
}

// ─── Day slot templates ───────────────────────────────────────────────────────

const DAY_SLOTS: Record<DayFocus, DaySlot[]> = {
  push: [
    { muscles: ['Chest'],              preferCompound: true  },
    { muscles: ['Shoulders'],          preferCompound: true  },
    { muscles: ['Chest'],              preferCompound: true  },
    { muscles: ['Triceps'],            preferCompound: false },
    { muscles: ['Chest', 'Shoulders'], preferCompound: false },
    { muscles: ['Triceps'],            preferCompound: false },
  ],
  pull: [
    { muscles: ['Back'],               preferCompound: true  },
    { muscles: ['Back'],               preferCompound: true  },
    { muscles: ['Back', 'Hamstrings'], preferCompound: true  },
    { muscles: ['Biceps'],             preferCompound: false },
    { muscles: ['Shoulders', 'Back'],  preferCompound: false },
    { muscles: ['Biceps'],             preferCompound: false },
  ],
  legs: [
    { muscles: ['Quads'],                    preferCompound: true  },
    { muscles: ['Hamstrings', 'Glutes'],     preferCompound: true  },
    { muscles: ['Glutes', 'Quads'],          preferCompound: true  },
    { muscles: ['Hamstrings'],               preferCompound: false },
    { muscles: ['Calves'],                   preferCompound: false },
    { muscles: ['Core'],                     preferCompound: false },
  ],
  upper: [
    { muscles: ['Chest'],              preferCompound: true  },
    { muscles: ['Back'],               preferCompound: true  },
    { muscles: ['Shoulders'],          preferCompound: true  },
    { muscles: ['Back'],               preferCompound: true  },
    { muscles: ['Biceps'],             preferCompound: false },
    { muscles: ['Triceps'],            preferCompound: false },
  ],
  lower: [
    { muscles: ['Quads'],                    preferCompound: true  },
    { muscles: ['Hamstrings', 'Glutes'],     preferCompound: true  },
    { muscles: ['Glutes', 'Quads'],          preferCompound: true  },
    { muscles: ['Hamstrings'],               preferCompound: false },
    { muscles: ['Calves'],                   preferCompound: false },
    { muscles: ['Core'],                     preferCompound: false },
  ],
  full_body: [
    { muscles: ['Chest', 'Shoulders'],       preferCompound: true  },
    { muscles: ['Back'],                     preferCompound: true  },
    { muscles: ['Quads'],                    preferCompound: true  },
    { muscles: ['Hamstrings', 'Glutes'],     preferCompound: true  },
    { muscles: ['Shoulders', 'Back', 'Biceps', 'Triceps'], preferCompound: false },
    { muscles: ['Core'],                     preferCompound: false },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSplitConfig(days: number): { splitType: SplitType; focuses: DayFocus[] } {
  if (days <= 3) return { splitType: 'full_body', focuses: Array(days).fill('full_body') as DayFocus[] }
  if (days === 4) return { splitType: 'upper_lower', focuses: ['upper', 'lower', 'upper', 'lower'] }
  const ppl: DayFocus[] = ['push', 'pull', 'legs']
  return {
    splitType: 'ppl',
    focuses:   Array.from({ length: days }, (_, i) => ppl[i % 3]),
  }
}

function getDayLabel(focus: DayFocus, variant: number): string {
  const variantStr = variant > 0 ? ` ${String.fromCharCode(65 + variant)}` : ''  // A, B, C...
  const labels: Record<DayFocus, string> = {
    full_body: `Full Body${variantStr}`,
    push:      `Push${variantStr}`,
    pull:      `Pull${variantStr}`,
    legs:      `Legs${variantStr}`,
    upper:     `Upper Body${variantStr}`,
    lower:     `Lower Body${variantStr}`,
  }
  return labels[focus]
}

function getScheme(goal: string, isDeload: boolean): ExerciseScheme {
  if (isDeload) return { reps: '12-15', restSeconds: 60 }
  switch (goal) {
    case 'lose_fat':            return { reps: '12-15', restSeconds: 60  }
    case 'build_muscle':        return { reps: '8-12',  restSeconds: 90  }
    case 'improve_performance': return { reps: '4-6',   restSeconds: 180 }
    default:                    return { reps: '10-12', restSeconds: 75  }
  }
}

function getSets(fitnessLevel: string, isCompound: boolean, isDeload: boolean): number {
  if (isDeload) return 2
  const base = fitnessLevel === 'advanced' ? 4 : 3
  return isCompound ? base : Math.max(2, base - 1)
}

function getTotalExercises(sessionDurationMins: number): number {
  if (sessionDurationMins < 45) return 3
  if (sessionDurationMins < 60) return 4
  if (sessionDurationMins < 75) return 5
  return 6
}

function estimateDuration(exercises: GeneratedExercise[]): number {
  const work = exercises.reduce(
    (acc, e) => acc + (e.isCompound ? 12 : 8) * (e.sets / 3),
    0,
  )
  return Math.round(5 + work)
}

function getAvailableCatalog(equipment: string[], injuries: string): CatalogExercise[] {
  const effective = new Set([...equipment, 'bodyweight'])
  const injuryLower = (injuries ?? '').toLowerCase()

  return CATALOG.filter(
    e =>
      e.equipment.some(eq => effective.has(eq)) &&
      !e.avoidIf.some(kw => injuryLower.includes(kw)),
  )
}

function pickExercisesForDay(
  available: CatalogExercise[],
  focus: DayFocus,
  total: number,
  variant: number,
): CatalogExercise[] {
  const fits = available.filter(e => e.fits.includes(focus))
  const slots = DAY_SLOTS[focus]

  const selected: CatalogExercise[] = []
  const usedNames   = new Set<string>()
  const usedMuscles = new Set<string>()

  for (const slot of slots) {
    if (selected.length >= total) break

    const candidates = fits.filter(
      e => slot.muscles.includes(e.muscleGroup) && !usedNames.has(e.name),
    )

    const sorted = [...candidates].sort((a, b) => {
      const aScore = a.isCompound === slot.preferCompound ? 0 : 1
      const bScore = b.isCompound === slot.preferCompound ? 0 : 1
      return aScore - bScore
    })

    if (sorted.length > 0) {
      const pick = sorted[variant % sorted.length]
      selected.push(pick)
      usedNames.add(pick.name)
      usedMuscles.add(pick.muscleGroup)
    }
  }

  return selected
}

function buildRationale(
  profile: UserProfileData,
  splitType: SplitType,
  adj: TrainingAdjustment,
): string[] {
  const lines: string[] = []
  const splitLabels: Record<SplitType, string> = {
    full_body:   'Full Body',
    upper_lower: 'Upper / Lower',
    ppl:         'Push / Pull / Legs',
  }
  lines.push(`${splitLabels[splitType]} split based on ${profile.trainingDaysPerWeek} training days/week.`)

  if (adj.isDeloadWeek) lines.push('Deload week: sets and intensity reduced to aid recovery.')
  if (adj.volumeModifier < 1) lines.push(`Volume reduced ×${adj.volumeModifier.toFixed(1)} due to fatigue or plateau.`)
  if (adj.intensityModifier < 1) lines.push('Intensity kept moderate — prioritise form and recovery.')

  const goalMsg: Record<string, string> = {
    lose_fat:            'Higher rep ranges (12-15) with short rest to maximise calorie burn.',
    build_muscle:        'Hypertrophy rep ranges (8-12) with 90 s rest for optimal muscle growth.',
    improve_performance: 'Strength rep ranges (4-6) with extended rest for maximal output.',
    maintain:            'Moderate rep ranges (10-12) to maintain strength and muscle mass.',
  }
  const msg = goalMsg[profile.primaryGoal]
  if (msg) lines.push(msg)

  return lines
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildRoutine(
  profile: UserProfileData,
  adj: TrainingAdjustment,
): RoutineRecommendation {
  const injuries     = (profile as UserProfileData & { injuries?: string | null }).injuries ?? ''
  const available    = getAvailableCatalog(profile.equipment, injuries)
  const scheme       = getScheme(profile.primaryGoal, adj.isDeloadWeek)
  const totalEx      = getTotalExercises(profile.sessionDurationMins)
  const { splitType, focuses } = getSplitConfig(profile.trainingDaysPerWeek)

  // Count how many times each focus appears (for variant labelling A, B, C)
  const focusCounter: Partial<Record<DayFocus, number>> = {}

  const days: WorkoutDay[] = focuses.map((focus, i) => {
    const variant = focusCounter[focus] ?? 0
    focusCounter[focus] = variant + 1

    const catalog  = pickExercisesForDay(available, focus, totalEx, variant)
    const exercises: GeneratedExercise[] = catalog.map(e => ({
      name:        e.name,
      muscleGroup: e.muscleGroup,
      sets:        getSets(profile.fitnessLevel, e.isCompound, adj.isDeloadWeek),
      reps:        scheme.reps,
      restSeconds: scheme.restSeconds,
      isCompound:  e.isCompound,
      notes:       adj.isDeloadWeek ? 'Deload — focus on form' : undefined,
    }))

    return {
      dayIndex:              i + 1,
      label:                 getDayLabel(focus, variant),
      focus,
      exercises,
      estimatedDurationMins: estimateDuration(exercises),
    }
  })

  const totalWeeklySets = days.reduce(
    (acc, d) => acc + d.exercises.reduce((a, e) => a + e.sets, 0),
    0,
  )

  return {
    splitType,
    days,
    totalWeeklySets,
    rationale: buildRationale(profile, splitType, adj),
  }
}
