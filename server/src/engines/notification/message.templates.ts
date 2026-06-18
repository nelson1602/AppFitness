import type { ReadinessScore } from '../health/health.types'

const pick = <T>(arr: T[]): T => arr[Math.floor(Date.now() / 60000) % arr.length]

export function getReadinessMessage(readiness: ReadinessScore): string {
  const pool: Record<ReadinessScore['status'], string[]> = {
    excellent: [
      "You're fully charged — make the most of today's session.",
      'Recovery is optimal. Push your limits.',
      'All systems go. Your body is primed for intensity.',
    ],
    good: [
      'Looking solid. Train smart and consistent.',
      'Good energy — focus on form and execution.',
      'Ready to train. Stay the course.',
    ],
    fair: [
      'Train, but dial back intensity a notch. Listen to your body.',
      'Moderate readiness: quality over quantity today.',
      'Your body is asking you to pace yourself — respect that.',
    ],
    poor: [
      'Your body needs rest more than reps right now.',
      'Low readiness detected — consider active recovery or a rest day.',
      'Recovery takes courage too. Prioritize sleep and nutrition.',
    ],
  }
  return pick(pool[readiness.status])
}

export function getMotivationMessage(streak: number, workoutsThisWeek: number): string {
  if (streak >= 30) return `${streak} days strong! You're in elite territory.`
  if (streak >= 14) return `${streak}-day streak — you've built something real. Don't stop.`
  if (streak >= 7)  return `One full week straight! Habits are forming.`
  if (workoutsThisWeek >= 3) return 'Solid week — one more session and you nail your target.'
  if (workoutsThisWeek === 0) return "Get one session in today — momentum starts with a single rep."
  return "You showed up. That's 90% of the battle won."
}

export function getPlateauMessage(goal: string): string {
  return goal === 'lose_fat'
    ? 'Weight plateau — try adding 20 min cardio or reducing carbs by 30 g.'
    : 'Weight plateau — add 150 kcal and one extra set per major lift.'
}

export function getDeloadMessage(reason: string): string {
  return `Deload week recommended: ${reason}. Reduce weight by 40%, focus on technique.`
}

export function getLowProteinMessage(actual: number, target: number): string {
  return `Averaging ${Math.round(actual)}g protein vs your ${Math.round(target)}g target. Prioritize protein in every meal.`
}
