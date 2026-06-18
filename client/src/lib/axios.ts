import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'

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

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

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
      clearAuth()
      queue = []
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
