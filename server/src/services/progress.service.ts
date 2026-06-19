import { buildCoachContext } from './coach.service'
import { ProgressEngine }   from '@/engines/progress/progress.engine'

const progressEngine = new ProgressEngine()

export const getProgressReport = async (userId: string) => {
  const ctx      = await buildCoachContext(userId)
  const analysis = progressEngine.analyze(ctx)

  return {
    ...analysis,
    currentWeightKg:    ctx.currentWeightKg,
    targetWeightKg:     ctx.profile.targetWeightKg,
    totalPRs:           ctx.stats.prsSet,
    totalWorkouts:      ctx.stats.workoutsLogged,
    currentStreak:      ctx.stats.currentStreak,
    recentVolumeKg:     Math.round(ctx.recentVolumeKg),
    avgVolumeKg:        Math.round(ctx.avgVolumeKg),
    trainingDaysActual: ctx.trainingDaysActual,
    trainingDaysTarget: ctx.profile.trainingDaysPerWeek,
  }
}
