import api from '@/lib/axios'
import type { HealthLog, ReadinessScore } from '@/types/engines'

interface HealthLogResponse {
  log:       HealthLog | null
  readiness: ReadinessScore
}

export const fetchTodayHealth = async (): Promise<HealthLogResponse> => {
  const { data } = await api.get<HealthLogResponse>('/health/today')
  return data
}

export const logHealth = async (payload: {
  date:          string
  sleepHours?:   number
  sleepQuality?: number
  energyLevel?:  number
  stressLevel?:  number
  restingHR?:    number
  mood?:         number
  notes?:        string
}): Promise<HealthLogResponse> => {
  const { data } = await api.post<HealthLogResponse>('/health', payload)
  return data
}

export const fetchHealthHistory = async (days = 14): Promise<HealthLog[]> => {
  const { data } = await api.get<HealthLog[]>(`/health/history?days=${days}`)
  return data
}
