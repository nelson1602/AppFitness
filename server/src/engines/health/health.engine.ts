import type { HealthLogData }                       from '../coach/coach.types'
import type { HealthLogInput, ReadinessFactor, ReadinessScore } from './health.types'

export class HealthEngine {
  calculateReadiness(log: HealthLogData | HealthLogInput | null): ReadinessScore {
    if (!log) return this.defaultReadiness()

    const factors: ReadinessFactor[] = [
      this.scoreSleep(log.sleepHours ?? null, log.sleepQuality ?? null),
      this.scoreEnergy(log.energyLevel ?? null),
      this.scoreStress(log.stressLevel ?? null),
      this.scoreMood(log.mood ?? null),
    ]

    const score = factors.reduce((acc, f) => acc + f.score * f.weight, 0)

    return {
      score:          Math.round(Math.min(100, Math.max(0, score))),
      status:         this.statusFromScore(score),
      factors,
      recommendation: this.recommendationFromScore(score),
    }
  }

  private scoreSleep(hours: number | null, quality: number | null): ReadinessFactor {
    if (hours == null) {
      return { name: 'Sleep', score: 55, weight: 0.35, message: 'No sleep data logged' }
    }
    const hoursScore   = Math.min(100, (hours / 8) * 100)
    const qualityScore = quality != null ? (quality / 5) * 100 : hoursScore
    const score        = hoursScore * 0.6 + qualityScore * 0.4

    const message =
      hours < 5   ? 'Severely sleep deprived' :
      hours < 6.5 ? 'Under-rested — recovery impaired' :
      hours < 7.5 ? 'Adequate sleep' :
      hours >= 9  ? 'Excellent sleep duration' :
                    'Well rested'

    return { name: 'Sleep', score: Math.round(score), weight: 0.35, message }
  }

  private scoreEnergy(energy: number | null): ReadinessFactor {
    const score   = energy != null ? (energy / 5) * 100 : 60
    const labels  = ['Very low energy', 'Low energy', 'Moderate energy', 'Good energy', 'High energy']
    const message = energy != null ? (labels[energy - 1] ?? 'Good energy') : 'No energy data'
    return { name: 'Energy', score: Math.round(score), weight: 0.30, message }
  }

  private scoreStress(stress: number | null): ReadinessFactor {
    const score   = stress != null ? ((5 - stress) / 4) * 100 : 60
    const labels  = ['Very relaxed', 'Low stress', 'Moderate stress', 'High stress', 'Extreme stress']
    const message = stress != null ? (labels[stress - 1] ?? 'Moderate stress') : 'No stress data'
    return { name: 'Stress', score: Math.round(score), weight: 0.25, message }
  }

  private scoreMood(mood: number | null): ReadinessFactor {
    const score   = mood != null ? (mood / 5) * 100 : 60
    const labels  = ['Very poor', 'Poor', 'Neutral', 'Good', 'Excellent']
    const message = mood != null ? `${labels[mood - 1] ?? 'Neutral'} mood` : 'No mood data'
    return { name: 'Mood', score: Math.round(score), weight: 0.10, message }
  }

  private statusFromScore(score: number): ReadinessScore['status'] {
    if (score >= 85) return 'excellent'
    if (score >= 70) return 'good'
    if (score >= 50) return 'fair'
    return 'poor'
  }

  private recommendationFromScore(score: number): string {
    if (score >= 85) return 'Excellent recovery — push hard today.'
    if (score >= 70) return 'Good to train at full intensity.'
    if (score >= 50) return 'Train, but reduce intensity by 10–15%.'
    return 'Consider rest or a light recovery session.'
  }

  private defaultReadiness(): ReadinessScore {
    return {
      score:          65,
      status:         'fair',
      factors:        [],
      recommendation: 'Log your daily health data to get a personalized readiness score.',
    }
  }
}
