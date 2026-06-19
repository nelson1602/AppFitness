import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AppShell }       from '@/components/layout/AppShell'
import { Spinner }        from '@/components/ui/Spinner'
import { OfflineBanner }  from '@/components/ui/OfflineBanner'
import { Toaster }        from '@/components/ui/Toaster'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAuthStore }   from '@/store/auth.store'
import api                from '@/lib/axios'
import { fetchProfile }   from '@/features/profile/api'
import { LandingPage }    from '@/pages/LandingPage'
import type { User }      from '@/types'

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const LoginPage            = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage         = lazy(() => import('@/pages/RegisterPage').then(m => ({ default: m.RegisterPage })))
const OnboardingPage       = lazy(() => import('@/pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })))
const DashboardPage        = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const WorkoutsPage         = lazy(() => import('@/pages/WorkoutsPage').then(m => ({ default: m.WorkoutsPage })))
const RoutineFormPage      = lazy(() => import('@/pages/RoutineFormPage').then(m => ({ default: m.RoutineFormPage })))
const ActiveWorkoutPage    = lazy(() => import('@/pages/ActiveWorkoutPage').then(m => ({ default: m.ActiveWorkoutPage })))
const WorkoutLogDetailPage = lazy(() => import('@/pages/WorkoutLogDetailPage').then(m => ({ default: m.WorkoutLogDetailPage })))
const NutritionPage        = lazy(() => import('@/pages/NutritionPage').then(m => ({ default: m.NutritionPage })))
const CoachPage            = lazy(() => import('@/pages/CoachPage').then(m => ({ default: m.CoachPage })))
const ProfilePage          = lazy(() => import('@/pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const GamificationPage     = lazy(() => import('@/pages/GamificationPage').then(m => ({ default: m.GamificationPage })))
const ProgressPage         = lazy(() => import('@/pages/ProgressPage').then(m => ({ default: m.ProgressPage })))

// ─── Shared fallbacks ─────────────────────────────────────────────────────────
const FullPageSpinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Spinner className="w-8 h-8 text-primary" />
  </div>
)

const ContentSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <Spinner className="w-6 h-6 text-primary" />
  </div>
)

// ─── Route guards ─────────────────────────────────────────────────────────────
const ProtectedRoute = () => {
  const user = useAuthStore((s) => s.user)
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((s) => s.user)
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

const LandingRoute = () => {
  const user = useAuthStore((s) => s.user)
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />
}

const OnboardingGuard = ({ ok }: { ok: boolean | null }) => {
  if (ok === null) return <FullPageSpinner />
  if (!ok) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

// Keeps AppShell nav visible while a lazy page loads inside the content area
const SuspenseOutlet = () => (
  <Suspense fallback={<ContentSpinner />}>
    <Outlet />
  </Suspense>
)

// ─── Routes ───────────────────────────────────────────────────────────────────
interface RoutesProps {
  profileComplete:      boolean | null
  onOnboardingComplete: () => void
}

const AppRoutes = ({ profileComplete, onOnboardingComplete }: RoutesProps) => (
  <Routes>
    <Route index element={<LandingRoute />} />

    <Route path="/login" element={
      <PublicRoute>
        <Suspense fallback={<FullPageSpinner />}><LoginPage /></Suspense>
      </PublicRoute>
    } />
    <Route path="/register" element={
      <PublicRoute>
        <Suspense fallback={<FullPageSpinner />}><RegisterPage /></Suspense>
      </PublicRoute>
    } />

    <Route element={<ProtectedRoute />}>
      <Route path="/onboarding" element={
        <Suspense fallback={<FullPageSpinner />}>
          <OnboardingPage onComplete={onOnboardingComplete} />
        </Suspense>
      } />

      <Route element={<OnboardingGuard ok={profileComplete} />}>
        <Route element={<AppShell />}>
          <Route element={<SuspenseOutlet />}>
            <Route path="/dashboard"               element={<DashboardPage />} />
            <Route path="/workouts"                element={<WorkoutsPage />} />
            <Route path="/workouts/new"            element={<RoutineFormPage />} />
            <Route path="/workouts/:id/edit"       element={<RoutineFormPage />} />
            <Route path="/workouts/active/:logId"  element={<ActiveWorkoutPage />} />
            <Route path="/workouts/log/:id"        element={<WorkoutLogDetailPage />} />
            <Route path="/nutrition"               element={<NutritionPage />} />
            <Route path="/coach"                   element={<CoachPage />} />
            <Route path="/profile"                 element={<ProfilePage />} />
            <Route path="/achievements"            element={<GamificationPage />} />
            <Route path="/progress"                element={<ProgressPage />} />
          </Route>
        </Route>
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

// ─── App ──────────────────────────────────────────────────────────────────────
export const App = () => {
  const [ready, setReady] = useState(false)
  const { accessToken, user, setAuth, clearAuth, profileComplete, setProfileComplete } = useAuthStore()
  const online = useOnlineStatus()

  const checkedUserRef = useRef<string | null>(null)

  // Initial auth check — runs once on mount
  useEffect(() => {
    const init = async () => {
      if (accessToken) {
        try {
          const { data } = await api.get<User>('/auth/me')
          setAuth({ user: data })
          try {
            const p = await fetchProfile()
            setProfileComplete(!!(p?.birthDate))
            checkedUserRef.current = data.id
          } catch {
            setProfileComplete(false)
            checkedUserRef.current = data.id
          }
        } catch {
          clearAuth()
          setProfileComplete(null)
        }
      }
      setReady(true)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check profile when user changes in-session
  useEffect(() => {
    if (!ready) return
    if (!user?.id || user.id === checkedUserRef.current) return
    checkedUserRef.current = user.id
    fetchProfile()
      .then(p => setProfileComplete(!!(p?.birthDate)))
      .catch(() => setProfileComplete(false))
  }, [ready, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <FullPageSpinner />

  return (
    <BrowserRouter>
      {!online && <OfflineBanner />}
      <Toaster />
      <AppRoutes
        profileComplete={profileComplete}
        onOnboardingComplete={() => setProfileComplete(true)}
      />
    </BrowserRouter>
  )
}
