export interface ReadinessFactor {
  name: string
  score: number
  weight: number
  message: string
}

export interface ReadinessScore {
  score: number
  status: 'excellent' | 'good' | 'fair' | 'poor'
  factors: ReadinessFactor[]
  recommendation: string
}

export interface HealthLogInput {
  sleepHours?: number | null
  sleepQuality?: number | null
  energyLevel?: number | null
  stressLevel?: number | null
  restingHR?: number | null
  mood?: number | null
}
