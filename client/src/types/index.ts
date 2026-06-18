export interface User {
  id: string
  email: string
  username: string
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
