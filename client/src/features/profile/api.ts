import api from '@/lib/axios'
import type { UserProfile } from '@/types/profile'

export const fetchProfile = async (): Promise<UserProfile | null> => {
  const { data } = await api.get<UserProfile | null>('/profile')
  return data
}

export const saveProfile = async (payload: Partial<UserProfile>): Promise<UserProfile> => {
  const { data } = await api.put<UserProfile>('/profile', payload)
  return data
}
