import { prisma } from '@/config/prisma'
import type { SaveMeasurementInput } from '@/models/measurement.model'

export const saveMeasurement = (userId: string, data: SaveMeasurementInput) =>
  prisma.bodyMeasurement.upsert({
    where:  { userId_date: { userId, date: data.date } },
    create: { userId, ...data },
    update: { ...data },
  })

export const getMeasurements = (userId: string, limit = 30) =>
  prisma.bodyMeasurement.findMany({
    where:   { userId },
    orderBy: { date: 'desc' },
    take:    limit,
  })

export const getLatestMeasurement = (userId: string) =>
  prisma.bodyMeasurement.findFirst({
    where:   { userId },
    orderBy: { date: 'desc' },
  })
