import { z } from 'zod'

export const saveMeasurementSchema = z.object({
  body: z.object({
    date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    bodyFatPct: z.number().min(1).max(60).optional(),
    waistCm:    z.number().min(30).max(250).optional(),
    hipCm:      z.number().min(30).max(250).optional(),
    chestCm:    z.number().min(30).max(250).optional(),
    leftArmCm:  z.number().min(10).max(100).optional(),
    rightArmCm: z.number().min(10).max(100).optional(),
    neckCm:     z.number().min(20).max(100).optional(),
    notes:      z.string().max(500).optional(),
  }),
})

export type SaveMeasurementInput = z.infer<typeof saveMeasurementSchema>['body']
