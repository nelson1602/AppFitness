import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/auth.store'
import api from '@/lib/axios'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { WorkoutsPage } from '@/pages/WorkoutsPage'
import { RoutineFormPage } from '@/pages/RoutineFormPage'
import { ActiveWorkoutPage } from '@/pages/ActiveWorkoutPage'
import { NutritionPage } from '@/pages/NutritionPage'
import type { User } from '@/types'

const ProtectedRoute = () => {
  const user = useAuthStore((s) => s.user)
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((s) => s.user)
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workouts"                element={<WorkoutsPage />} />
        <Route path="/workouts/new"            element={<RoutineFormPage />} />
        <Route path="/workouts/:id/edit"       element={<RoutineFormPage />} />
        <Route path="/workouts/active/:logId"  element={<ActiveWorkoutPage />} />
        <Route path="/nutrition"               element={<NutritionPage />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

export const App = () => {
  const [ready, setReady] = useState(false)
  const { accessToken, setAuth, clearAuth } = useAuthStore()

  useEffect(() => {
    const init = async () => {
      if (accessToken) {
        try {
          const { data } = await api.get<User>('/auth/me')
          setAuth({ user: data })
        } catch {
          clearAuth()
        }
      }
      setReady(true)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
