import api from '@/lib/axios'
import type { BodyMeasurement, SaveMeasurementPayload } from '@/types/measurement'

export const saveMeasurement = (data: SaveMeasurementPayload) =>
  api.post<BodyMeasurement>('/measurements', data).then(r => r.data)

export const fetchMeasurements = (limit = 30) =>
  api.get<BodyMeasurement[]>('/measurements', { params: { limit } }).then(r => r.data)

export const fetchLatestMeasurement = () =>
  api.get<BodyMeasurement | null>('/measurements/latest').then(r => r.data)
