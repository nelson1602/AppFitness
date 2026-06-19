import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  profileComplete: boolean | null  // null = loading/unknown
  setAuth: (data: Partial<Pick<AuthState, 'user' | 'accessToken' | 'refreshToken'>>) => void
  setProfileComplete: (v: boolean | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      profileComplete: null,
      setAuth: (data) => set(data),
      setProfileComplete: (v) => set({ profileComplete: v }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, profileComplete: null }),
    }),
    {
      name: 'fitness-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }),
    },
  ),
)
