import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import api from '@/lib/axios'

export const useLogout = () => {
  const { refreshToken, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  return async () => {
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken })
    } finally {
      clearAuth()
      navigate('/login')
    }
  }
}
