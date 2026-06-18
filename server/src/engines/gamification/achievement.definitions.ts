import type { AchievementDef } from './gamification.types'

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_workout', name: 'First Steps',
    description: 'Complete your very first workout',
    icon: '👟', category: 'milestones', xpReward: 100,
    condition: ctx => ctx.isFirstWorkout,
  },
  {
    key: 'workouts_10', name: 'Dedicated',
    description: 'Log 10 workouts',
    icon: '💪', category: 'consistency', xpReward: 150,
    condition: ctx => ctx.workoutsLogged >= 10,
  },
  {
    key: 'workouts_50', name: 'Committed',
    description: 'Log 50 workouts',
    icon: '🏋️', category: 'consistency', xpReward: 300,
    condition: ctx => ctx.workoutsLogged >= 50,
  },
  {
    key: 'workouts_100', name: 'Century Club',
    description: 'Log 100 workouts',
    icon: '💯', category: 'milestones', xpReward: 500,
    condition: ctx => ctx.workoutsLogged >= 100,
  },
  {
    key: 'streak_7', name: 'Week Warrior',
    description: 'Maintain a 7-day activity streak',
    icon: '🔥', category: 'consistency', xpReward: 200,
    condition: ctx => ctx.currentStreak >= 7,
  },
  {
    key: 'streak_30', name: 'Iron Will',
    description: 'Maintain a 30-day activity streak',
    icon: '⚡', category: 'consistency', xpReward: 500,
    condition: ctx => ctx.currentStreak >= 30,
  },
  {
    key: 'pr_first', name: 'Personal Best',
    description: 'Set your first personal record',
    icon: '🏆', category: 'strength', xpReward: 100,
    condition: ctx => ctx.prsSet >= 1,
  },
  {
    key: 'pr_10', name: 'PR Machine',
    description: 'Set 10 personal records',
    icon: '🎯', category: 'strength', xpReward: 250,
    condition: ctx => ctx.prsSet >= 10,
  },
  {
    key: 'nutrition_7', name: 'Nutrition Pro',
    description: 'Log all meals for 7 days in a row',
    icon: '🥗', category: 'nutrition', xpReward: 200,
    condition: ctx => ctx.allMealsLoggedDays >= 7,
  },
  {
    key: 'deload_master', name: 'Deload Master',
    description: 'Complete a planned deload week',
    icon: '🔄', category: 'recovery', xpReward: 150,
    condition: ctx => ctx.deloadCompleted,
  },
  {
    key: 'comeback', name: 'Comeback Kid',
    description: 'Return to training after a 2-week break',
    icon: '🌅', category: 'consistency', xpReward: 150,
    condition: ctx => ctx.returnAfterBreak,
  },
  {
    key: 'goal_reached', name: 'Goal Crusher',
    description: 'Reach your target body weight',
    icon: '⭐', category: 'milestones', xpReward: 500,
    condition: ctx => ctx.goalReached,
  },
]
