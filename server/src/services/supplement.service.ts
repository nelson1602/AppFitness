import { prisma } from '@/config/prisma'

export interface SupplementSuggestion {
  key:      string
  name:     string
  emoji:    string
  reason:   string
  dosage:   string
  timing:   string
  priority: 'high' | 'medium' | 'low'
  category: 'recovery' | 'performance' | 'health' | 'nutrition'
}

export interface SupplementsResult {
  eligible:           boolean
  daysUntilEligible?: number
  goal:               string
  suggestions:        SupplementSuggestion[]
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export const getSupplements = async (userId: string): Promise<SupplementsResult> => {
  const [firstWorkout, profile, recentHealth] = await Promise.all([
    prisma.workoutLog.findFirst({
      where:   { userId, finishedAt: { not: null } },
      orderBy: { startedAt: 'asc' },
      select:  { startedAt: true },
    }),
    prisma.userProfile.findUnique({
      where:  { userId },
      select: {
        primaryGoal: true, trainingDaysPerWeek: true,
        sleepHours: true, stressLevel: true,
      },
    }),
    prisma.healthLog.findMany({
      where: { userId }, orderBy: { date: 'desc' }, take: 7,
      select: { sleepHours: true },
    }),
  ])

  const goal      = profile?.primaryGoal        ?? 'maintain'
  const trainDays = profile?.trainingDaysPerWeek ?? 3
  const profSleep = profile?.sleepHours          ?? 7
  const stress    = profile?.stressLevel         ?? 3

  if (!firstWorkout) return { eligible: false, goal, suggestions: [] }

  const daysSince = Math.floor(
    (Date.now() - firstWorkout.startedAt.getTime()) / 86_400_000,
  )
  if (daysSince < 7) {
    return { eligible: false, daysUntilEligible: 7 - daysSince, goal, suggestions: [] }
  }

  const avgSleep = recentHealth.length
    ? recentHealth.reduce((s, h) => s + (h.sleepHours ?? profSleep), 0) / recentHealth.length
    : profSleep

  const isStrength  = ['muscle_gain', 'build_muscle', 'strength', 'recomposition'].includes(goal)
  const isEndurance = ['endurance', 'improve_performance'].includes(goal)

  const suggestions: SupplementSuggestion[] = []

  // ── Protein ──────────────────────────────────────────────────────────────────
  suggestions.push({
    key:      'protein',
    name:     'Whey Protein',
    emoji:    '🥛',
    priority: isStrength ? 'high' : 'medium',
    category: 'nutrition',
    reason:   isStrength
      ? `With ${trainDays} training days/week and a ${goal.replace(/_/g, ' ')} goal, consistent protein intake is critical for muscle recovery.`
      : `Helps you hit your daily protein target conveniently, especially on busy days.`,
    dosage:   '25–30 g per serving',
    timing:   'Post-workout or as a meal supplement',
  })

  // ── Creatine ─────────────────────────────────────────────────────────────────
  if (isStrength || isEndurance) {
    suggestions.push({
      key:      'creatine',
      name:     'Creatine Monohydrate',
      emoji:    '💪',
      priority: ['strength', 'improve_performance'].includes(goal) ? 'high' : 'medium',
      category: 'performance',
      reason:   `The most researched supplement for ${goal.replace(/_/g, ' ')}. Increases max strength output and accelerates inter-set recovery.`,
      dosage:   '3–5 g/day',
      timing:   'Any time of day — daily consistency matters most',
    })
  }

  // ── Omega 3 ──────────────────────────────────────────────────────────────────
  if (['lose_fat', 'fat_loss', 'general_health', 'maintain'].includes(goal) || stress >= 4 || avgSleep < 6.5) {
    suggestions.push({
      key:      'omega3',
      name:     'Omega 3 (Fish Oil)',
      emoji:    '🐟',
      priority: stress >= 4 || avgSleep < 6.5 ? 'high' : 'medium',
      category: 'health',
      reason:   stress >= 4
        ? `Your stress level (${stress}/5) raises inflammation. Omega 3 helps regulate cortisol and supports recovery.`
        : avgSleep < 6.5
        ? `Low average sleep (${avgSleep.toFixed(1)}h) elevates cortisol. Omega 3 supports hormonal balance and reduces exercise-induced inflammation.`
        : `Supports fat oxidation, cardiovascular health, and reduces chronic inflammation — especially useful during a caloric deficit.`,
      dosage:   '1–3 g EPA+DHA per day',
      timing:   'With a meal (reduces aftertaste)',
    })
  }

  // ── Electrolytes ─────────────────────────────────────────────────────────────
  if (trainDays >= 4 || isEndurance || goal === 'lose_fat' || goal === 'fat_loss') {
    suggestions.push({
      key:      'electrolytes',
      name:     'Electrolytes',
      emoji:    '⚡',
      priority: isEndurance ? 'high' : 'medium',
      category: 'recovery',
      reason:   `With ${trainDays} sessions/week you lose significant sodium, potassium, and magnesium through sweat. Replenishing prevents fatigue and cramps.`,
      dosage:   'Per product label',
      timing:   'During or immediately after training',
    })
  }

  // ── Multivitamin ─────────────────────────────────────────────────────────────
  suggestions.push({
    key:      'multivitamin',
    name:     'Multivitamin',
    emoji:    '💊',
    priority: 'low',
    category: 'health',
    reason:   `Acts as a nutritional safety net — covers micronutrient gaps common even in well-planned diets.`,
    dosage:   '1 capsule/day',
    timing:   'With breakfast',
  })

  suggestions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return { eligible: true, goal, suggestions }
}
