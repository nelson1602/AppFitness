import { io } from 'socket.io-client'
import { useAuthStore } from '@/store/auth.store'

export const socket = io({
  path:        '/socket.io',
  autoConnect: false,
  auth: (cb: (data: { token: string }) => void) => {
    cb({ token: useAuthStore.getState().accessToken ?? '' })
  },
})
