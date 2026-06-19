import { prisma }                          from '@/config/prisma'
import { checkAndSendReevaluationEmail }   from '@/services/reevaluation.service'

const INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 h

const run = async () => {
  const users = await prisma.user.findMany({
    where: { profile: { isNot: null } },
    select: { id: true },
  })
  for (const { id } of users) {
    await checkAndSendReevaluationEmail(id).catch(() => {})
  }
}

export const startReevaluationJob = () => {
  // First run at startup, then repeat every 24 h
  void run()
  setInterval(() => { void run() }, INTERVAL_MS)
}
