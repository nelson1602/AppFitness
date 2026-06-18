import { z } from 'zod'

export const HealthLogSchema = z.object({
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  sleepHours:    z.number().min(0).max(24).optional(),
  sleepQuality:  z.number().int().min(1).max(5).optional(),
  energyLevel:   z.number().int().min(1).max(5).optional(),
  stressLevel:   z.number().int().min(1).max(5).optional(),
  restingHR:     z.number().int().min(30).max(220).optional(),
  mood:          z.number().int().min(1).max(5).optional(),
  notes:         z.string().max(500).optional(),
})
