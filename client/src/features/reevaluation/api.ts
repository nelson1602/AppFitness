import api from '@/lib/axios'
import type { ReevaluationStatus, ReevaluationResult } from '@/types/reevaluation'

export const fetchReevaluationStatus = () =>
  api.get<ReevaluationStatus>('/reevaluation/status').then((r) => r.data)

export const completeReevaluation = () =>
  api.post<ReevaluationResult>('/reevaluation/complete').then((r) => r.data)
