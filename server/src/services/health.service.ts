import { prisma }       from '@/config/prisma'
import { HealthEngine } from '@/engines/health/health.engine'

const engine = new HealthEngine()

export interface HealthLogInput {
  date:          string
  sleepHours?:   number
  sleepQuality?: number
  energyLevel?:  number
  stressLevel?:  number
  restingHR?:    number
  mood?:         number
  notes?:        string
}

export const upsertHealthLog = async (userId: string, input: HealthLogInput) => {
  const { date, ...rest } = input

  const log = await prisma.healthLog.upsert({
    where:  { userId_date: { userId, date } },
    create: { userId, date, ...rest },
    update: rest,
  })

  const readiness = engine.calculateReadiness(log)

  return prisma.healthLog.update({
    where: { id: log.id },
    data:  { readinessScore: readiness.score },
  })
}

export const getLatestHealthLog = (userId: string) =>
  prisma.healthLog.findFirst({
    where:   { userId },
    orderBy: { date: 'desc' },
  })

export const getTodayHealthLog = (userId: string) => {
  const today = new Date().toISOString().split('T')[0]
  return prisma.healthLog.findUnique({
    where: { userId_date: { userId, date: today } },
  })
}

export const getHealthHistory = (userId: string, days = 14) =>
  prisma.healthLog.findMany({
    where:   { userId },
    orderBy: { date: 'desc' },
    take:    days,
  })
