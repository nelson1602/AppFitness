import api from '@/lib/axios'
import type { SupplementsResult } from '@/types/supplement'

export const fetchSupplements = (): Promise<SupplementsResult> =>
  api.get<SupplementsResult>('/supplements').then((r) => r.data)
