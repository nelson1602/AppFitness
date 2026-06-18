import api from '@/lib/axios'
import type { GamificationData } from '@/types/engines'

export const fetchGamification = async (): Promise<GamificationData> => {
  const { data } = await api.get<GamificationData>('/gamification')
  return data
}
