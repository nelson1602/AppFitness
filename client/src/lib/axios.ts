import axios from 'axios'
import i18next from 'i18next'
import { useAuthStore } from '@/store/auth.store'
import { useToastStore } from '@/store/toast.store'

const api = axios.create({ baseURL: '/api', timeout: 10_000 })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let queue: Array<(token: string) => void> = []

const processQueue = (token: string) => {
  queue.forEach((cb) => cb(token))
  queue = []
}

// Auth endpoints manage their own inline error feedback — skip global toasts for them
const isAuthUrl = (url?: string) =>
  ['/auth/login', '/auth/register', '/auth/refresh'].some((p) => url?.includes(p))

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status: number | undefined = error.response?.status
    const toast = useToastStore.getState().add

    // ── 401: attempt token refresh ────────────────────────────────────────────
    if (status === 401 && !original._retry) {
      const { refreshToken, setAuth, clearAuth } = useAuthStore.getState()

      if (!refreshToken) {
        clearAuth()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          queue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
        setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken })
        original.headers.Authorization = `Bearer ${data.accessToken}`
        processQueue(data.accessToken)
        return api(original)
      } catch {
        toast('warning', i18next.t('errors.sessionExpired'), 6000)
        clearAuth()
        queue = []
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    // ── Global error toasts (skip auth endpoints — they handle errors inline) ─
    if (!isAuthUrl(original?.url)) {
      if (status === 429) {
        toast('warning', i18next.t('errors.tooManyRequests'))
      } else if (status !== undefined && status >= 500) {
        toast('error', i18next.t('errors.serverError'))
      }
    }

    return Promise.reject(error)
  },
)

export default api
