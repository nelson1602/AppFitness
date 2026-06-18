export interface GamificationContext {
  isFirstWorkout:      boolean
  workoutsLogged:      number
  mealsLoggedToday:    number
  allMealsLoggedDays:  number
  weightsLogged:       number
  currentStreak:       number
  prsSet:              number
  deloadCompleted:     boolean
  returnAfterBreak:    boolean
  goalReached:         boolean
}

export interface AchievementDef {
  key:         string
  name:        string
  description: string
  icon:        string
  category:    'consistency' | 'strength' | 'nutrition' | 'milestones' | 'recovery'
  xpReward:    number
  condition:   (ctx: GamificationContext) => boolean
}

export interface XPEvent {
  type:  string
  xp:    number
  label: string
}

export const XP_TABLE = {
  workout_logged:   50,
  meal_logged:      20,
  all_meals_logged: 30,
  weight_logged:    15,
  pr_set:          100,
  streak_7:        200,
  streak_30:       500,
  deload_completed: 75,
  goal_reached:    500,
} as const

export const LEVEL_THRESHOLDS = [0, 500, 1200, 2500, 4500, 7500, 11000, 16000, 22000, 30000]

export const LEVEL_NAMES = [
  'Beginner', 'Bronze', 'Silver', 'Gold', 'Platinum',
  'Diamond', 'Master', 'Grandmaster', 'Elite', 'Legend',
]
