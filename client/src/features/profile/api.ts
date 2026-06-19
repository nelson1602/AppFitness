import api from '@/lib/axios'
import type { UserProfile } from '@/types/profile'
import type { User } from '@/types'

export const fetchProfile = async (): Promise<UserProfile | null> => {
  const { data } = await api.get<UserProfile | null>('/profile')
  return data
}

export const saveProfile = async (payload: Partial<UserProfile>): Promise<UserProfile> => {
  const { data } = await api.put<UserProfile>('/profile', payload)
  return data
}

export const updateAccount = async (payload: {
  email?: string
  phone?: string
  avatarUrl?: string
}): Promise<User> => {
  const { data } = await api.patch<User>('/auth/account', payload)
  return data
}

export const changePassword = async (payload: {
  currentPassword: string
  newPassword: string
}): Promise<void> => {
  await api.post('/auth/change-password', payload)
}
