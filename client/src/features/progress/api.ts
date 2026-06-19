import api from '@/lib/axios'
import type { ProgressReport, Notification, SupplementReport } from '@/types/progress'

export const fetchProgressReport = () =>
  api.get<ProgressReport>('/progress/report').then((r) => r.data)

export const fetchNotifications = () =>
  api.get<Notification[]>('/notifications').then((r) => r.data)

export const fetchSupplements = () =>
  api.get<SupplementReport | null>('/recommendations/supplements').then((r) => r.data)
