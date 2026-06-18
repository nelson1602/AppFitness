import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const exercises = [
  // Chest
  { name: 'Bench Press', muscleGroup: 'Chest', category: 'strength' },
  { name: 'Incline Bench Press', muscleGroup: 'Chest', category: 'strength' },
  { name: 'Dumbbell Fly', muscleGroup: 'Chest', category: 'strength' },
  { name: 'Push-Up', muscleGroup: 'Chest', category: 'bodyweight' },
  // Back
  { name: 'Deadlift', muscleGroup: 'Back', category: 'strength' },
  { name: 'Pull-Up', muscleGroup: 'Back', category: 'bodyweight' },
  { name: 'Barbell Row', muscleGroup: 'Back', category: 'strength' },
  { name: 'Lat Pulldown', muscleGroup: 'Back', category: 'strength' },
  { name: 'Seated Cable Row', muscleGroup: 'Back', category: 'strength' },
  // Shoulders
  { name: 'Overhead Press', muscleGroup: 'Shoulders', category: 'strength' },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders', category: 'strength' },
  { name: 'Face Pull', muscleGroup: 'Shoulders', category: 'strength' },
  // Arms
  { name: 'Barbell Curl', muscleGroup: 'Biceps', category: 'strength' },
  { name: 'Hammer Curl', muscleGroup: 'Biceps', category: 'strength' },
  { name: 'Tricep Pushdown', muscleGroup: 'Triceps', category: 'strength' },
  { name: 'Skull Crusher', muscleGroup: 'Triceps', category: 'strength' },
  // Legs
  { name: 'Squat', muscleGroup: 'Quads', category: 'strength' },
  { name: 'Leg Press', muscleGroup: 'Quads', category: 'strength' },
  { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', category: 'strength' },
  { name: 'Leg Curl', muscleGroup: 'Hamstrings', category: 'strength' },
  { name: 'Calf Raise', muscleGroup: 'Calves', category: 'strength' },
  { name: 'Hip Thrust', muscleGroup: 'Glutes', category: 'strength' },
  // Core
  { name: 'Plank', muscleGroup: 'Core', category: 'bodyweight' },
  { name: 'Cable Crunch', muscleGroup: 'Core', category: 'strength' },
  // Cardio
  { name: 'Running', muscleGroup: 'Full Body', category: 'cardio' },
  { name: 'Cycling', muscleGroup: 'Full Body', category: 'cardio' },
  { name: 'Row Machine', muscleGroup: 'Full Body', category: 'cardio' },
]

const foods = [
  { name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
  { name: 'Brown Rice', calories: 111, protein: 2.6, carbs: 23, fat: 0.9, fiber: 1.8 },
  { name: 'Oats', calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6 },
  { name: 'Egg (whole)', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0 },
  { name: 'Egg White', calories: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0 },
  { name: 'Greek Yogurt (0%)', calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0 },
  { name: 'Cottage Cheese', calories: 98, protein: 11, carbs: 3.4, fat: 4.3, fiber: 0 },
  { name: 'Tuna (canned)', calories: 116, protein: 26, carbs: 0, fat: 1, fiber: 0 },
  { name: 'Salmon', calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
  { name: 'Sweet Potato', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3 },
  { name: 'Banana', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 },
  { name: 'Broccoli', calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6 },
  { name: 'Olive Oil', calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 },
  { name: 'Almonds', calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5 },
  { name: 'Whey Protein', calories: 400, protein: 80, carbs: 8, fat: 5, fiber: 0 },
]

const achievements = [
  { key: 'first_workout', name: 'First Steps',    description: 'Complete your very first workout',      icon: '👟', category: 'milestones',   xpReward: 100 },
  { key: 'workouts_10',   name: 'Dedicated',       description: 'Log 10 workouts',                       icon: '💪', category: 'consistency',  xpReward: 150 },
  { key: 'workouts_50',   name: 'Committed',       description: 'Log 50 workouts',                       icon: '🏋️', category: 'consistency',  xpReward: 300 },
  { key: 'workouts_100',  name: 'Century Club',    description: 'Log 100 workouts',                      icon: '💯', category: 'milestones',   xpReward: 500 },
  { key: 'streak_7',      name: 'Week Warrior',    description: 'Maintain a 7-day activity streak',      icon: '🔥', category: 'consistency',  xpReward: 200 },
  { key: 'streak_30',     name: 'Iron Will',       description: 'Maintain a 30-day activity streak',     icon: '⚡', category: 'consistency',  xpReward: 500 },
  { key: 'pr_first',      name: 'Personal Best',   description: 'Set your first personal record',        icon: '🏆', category: 'strength',     xpReward: 100 },
  { key: 'pr_10',         name: 'PR Machine',      description: 'Set 10 personal records',               icon: '🎯', category: 'strength',     xpReward: 250 },
  { key: 'nutrition_7',   name: 'Nutrition Pro',   description: 'Log all meals for 7 days in a row',     icon: '🥗', category: 'nutrition',    xpReward: 200 },
  { key: 'deload_master', name: 'Deload Master',   description: 'Complete a planned deload week',        icon: '🔄', category: 'recovery',     xpReward: 150 },
  { key: 'comeback',      name: 'Comeback Kid',    description: 'Return to training after a 2-week break', icon: '🌅', category: 'consistency', xpReward: 150 },
  { key: 'goal_reached',  name: 'Goal Crusher',    description: 'Reach your target body weight',         icon: '⭐', category: 'milestones',   xpReward: 500 },
]

async function main() {
  console.log('Seeding exercises...')
  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: {},
      create: exercise,
    })
  }

  console.log('Seeding foods...')
  for (const food of foods) {
    const existing = await prisma.food.findFirst({ where: { name: food.name } })
    if (!existing) await prisma.food.create({ data: food })
  }

  console.log('Seeding achievements...')
  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where:  { key: ach.key },
      update: { name: ach.name, description: ach.description, icon: ach.icon, xpReward: ach.xpReward },
      create: ach,
    })
  }

  console.log('Seed completed.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
