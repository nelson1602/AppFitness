import { FormEvent, useState } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Activity, Eye, EyeOff } from 'lucide-react'
import axios from 'axios'
import api from '@/lib/axios'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { AuthResponse } from '@/types'

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const USERNAME_RE = /^[a-zA-Z0-9_]+$/

interface FieldErrors {
  username?: string
  email?: string
  password?: string
}

type PasswordStrength = 'weak' | 'fair' | 'strong'

const getPasswordStrength = (pwd: string): PasswordStrength | null => {
  if (pwd.length < 8) return null
  const score = [/[a-zA-Z]/.test(pwd), /[0-9]/.test(pwd), /[^a-zA-Z0-9]/.test(pwd)].filter(Boolean).length
  if (score === 1) return 'weak'
  if (score === 2) return 'fair'
  return 'strong'
}

const STRENGTH_COLORS: Record<PasswordStrength, { color: string; bars: number }> = {
  weak:   { color: 'bg-error',   bars: 1 },
  fair:   { color: 'bg-warning', bars: 2 },
  strong: { color: 'bg-success', bars: 3 },
}

export const RegisterPage = () => {
  usePageTitle('Create account')
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  const { setAuth, setProfileComplete } = useAuthStore()
  const navigate = useNavigate()

  const strength = getPasswordStrength(password)

  const validate = (): boolean => {
    const errors: FieldErrors = {}
    if (username.length < 3) errors.username = t('auth.register.errors.usernameShort')
    else if (!USERNAME_RE.test(username)) errors.username = t('auth.register.errors.usernameInvalid')
    if (!EMAIL_RE.test(email)) errors.email = t('auth.register.errors.email')
    if (password.length < 8) errors.password = t('auth.register.errors.passwordShort')
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError('')
    if (!validate()) return
    setIsLoading(true)
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', { username, email, password })
      setAuth({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken })
      setProfileComplete(false)
      navigate('/onboarding')
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setServerError(err.response?.data?.error ?? t('auth.register.errors.server'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary-muted flex items-center justify-center">
            <Activity className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">{t('auth.register.title')}</h1>
          <p className="text-sm text-text-secondary">{t('auth.register.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {serverError && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
              {serverError}
            </div>
          )}

          <Input
            label={t('auth.register.username')}
            type="text"
            placeholder="johndoe"
            autoComplete="username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setFieldErrors((p) => ({ ...p, username: undefined })) }}
            leftIcon={<User className="w-4 h-4" />}
            error={fieldErrors.username}
            hint={!fieldErrors.username ? t('auth.register.usernameHint') : undefined}
          />

          <Input
            label={t('auth.register.email')}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })) }}
            leftIcon={<Mail className="w-4 h-4" />}
            error={fieldErrors.email}
          />

          <div className="flex flex-col gap-1.5">
            <Input
              label={t('auth.register.password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })) }}
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-text-muted hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              error={fieldErrors.password}
            />
            {password.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map((bar) => (
                    <div
                      key={bar}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        strength && STRENGTH_COLORS[strength].bars >= bar
                          ? STRENGTH_COLORS[strength].color
                          : 'bg-surface-2'
                      }`}
                    />
                  ))}
                </div>
                {strength && (
                  <span className="text-xs text-text-muted">{t(`auth.register.strength.${strength}`)}</span>
                )}
              </div>
            )}
          </div>

          <Button type="submit" size="lg" isLoading={isLoading} className="mt-2 w-full">
            {t('auth.register.createAccount')}
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          {t('auth.register.alreadyHave')}{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            {t('auth.register.signIn')}
          </Link>
        </p>
      </div>
    </div>
  )
}
