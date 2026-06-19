export interface User {
  id: string
  email: string
  username: string
  phone: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface ApiError {
  error: string
  details?: Record<string, string[]>
}
