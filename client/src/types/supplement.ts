export type SupplementPriority = 'high' | 'medium' | 'low'
export type SupplementCategory = 'recovery' | 'performance' | 'health' | 'nutrition'

export interface SupplementSuggestion {
  key:      string
  name:     string
  emoji:    string
  priority: SupplementPriority
  category: SupplementCategory
  reason:   string
  dosage:   string
  timing:   string
}

export interface SupplementsResult {
  eligible:           boolean
  daysUntilEligible?: number
  goal:               string
  suggestions:        SupplementSuggestion[]
}
