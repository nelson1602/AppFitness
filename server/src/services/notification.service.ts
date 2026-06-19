import { buildCoachContext }  from './coach.service'
import { HealthEngine }       from '@/engines/health/health.engine'
import { ProgressEngine }     from '@/engines/progress/progress.engine'
import { NotificationEngine } from '@/engines/notification/notification.engine'

const healthEngine   = new HealthEngine()
const progressEngine = new ProgressEngine()
const notifEngine    = new NotificationEngine()

export const getNotifications = async (userId: string) => {
  const ctx       = await buildCoachContext(userId)
  const readiness = healthEngine.calculateReadiness(ctx.latestHealthLog)
  const progress  = progressEngine.analyze(ctx)
  return notifEngine.generate(ctx, progress, readiness)
}
