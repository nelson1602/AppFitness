import api from '@/lib/axios'
import type { DashboardSummary, WeightEntry, WeeklyVolume, DailyNutrition, CoachInsight } from '@/types/dashboard'

export const fetchSummary = () =>
  api.get<DashboardSummary>('/dashboard/summary').then((r) => r.data)

export const fetchWeightHistory = (weeks = 12) =>
  api.get<WeightEntry[]>('/dashboard/weight-history', { params: { weeks } }).then((r) => r.data)

export const fetchWeeklyVolume = (weeks = 8) =>
  api.get<WeeklyVolume[]>('/dashboard/weekly-volume', { params: { weeks } }).then((r) => r.data)

export const fetchNutritionWeek = () =>
  api.get<DailyNutrition[]>('/dashboard/nutrition-week').then((r) => r.data)

export const logBodyWeight = (data: { weight: number; date: string; notes?: string }) =>
  api.post<WeightEntry>('/dashboard/bodyweight', data).then((r) => r.data)

export const deleteBodyWeight = (id: string) =>
  api.delete(`/dashboard/bodyweight/${id}`)

export const fetchCoachInsight = () =>
  api.get<CoachInsight | null>('/dashboard/coach-insight').then((r) => r.data)
