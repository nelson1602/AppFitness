import api from '@/lib/axios'
import type { CoachReport } from '@/types/engines'

export const fetchCoachReport = async (): Promise<CoachReport> => {
  const { data } = await api.get<CoachReport>('/coach/report')
  return data
}

export const applyNutritionRecommendation = async (): Promise<void> => {
  await api.post('/coach/apply-nutrition')
}

export const saveWeeklySnapshot = async (): Promise<void> => {
  await api.post('/coach/snapshot')
}

export const applyRoutineRecommendation = async (): Promise<{ days: number }> => {
  const { data } = await api.post<{ message: string; days: number }>('/coach/apply-routine')
  return data
}
