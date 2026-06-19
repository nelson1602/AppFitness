export interface BodyMeasurement {
  id:         string
  userId:     string
  date:       string
  bodyFatPct: number | null
  waistCm:    number | null
  hipCm:      number | null
  chestCm:    number | null
  leftArmCm:  number | null
  rightArmCm: number | null
  neckCm:     number | null
  notes:      string | null
  createdAt:  string
}

export type SaveMeasurementPayload = {
  date:       string
  bodyFatPct?: number
  waistCm?:    number
  hipCm?:      number
  chestCm?:    number
  leftArmCm?:  number
  rightArmCm?: number
  neckCm?:     number
  notes?:      string
}
