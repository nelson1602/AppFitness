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
  // ── Proteins ────────────────────────────────────────────────────────────────
  { name: 'Chicken Breast',          calories: 165, protein: 31.0, carbs: 0.0,  fat: 3.6,  fiber: 0 },
  { name: 'Chicken Thigh',           calories: 209, protein: 26.0, carbs: 0.0,  fat: 11.3, fiber: 0 },
  { name: 'Ground Beef 90%',         calories: 176, protein: 27.2, carbs: 0.0,  fat: 7.1,  fiber: 0 },
  { name: 'Ground Beef 80%',         calories: 254, protein: 26.1, carbs: 0.0,  fat: 17.4, fiber: 0 },
  { name: 'Turkey Breast',           calories: 189, protein: 29.1, carbs: 0.0,  fat: 7.4,  fiber: 0 },
  { name: 'Salmon',                  calories: 208, protein: 20.0, carbs: 0.0,  fat: 13.0, fiber: 0 },
  { name: 'Tuna (canned)',           calories: 116, protein: 26.0, carbs: 0.0,  fat: 1.0,  fiber: 0 },
  { name: 'Tilapia',                 calories: 128, protein: 26.2, carbs: 0.0,  fat: 2.7,  fiber: 0 },
  { name: 'Shrimp',                  calories: 99,  protein: 24.0, carbs: 0.2,  fat: 0.3,  fiber: 0 },
  { name: 'Egg (whole)',             calories: 155, protein: 13.0, carbs: 1.1,  fat: 11.0, fiber: 0 },
  { name: 'Egg White',               calories: 52,  protein: 11.0, carbs: 0.7,  fat: 0.2,  fiber: 0 },
  { name: 'Greek Yogurt (0%)',       calories: 59,  protein: 10.0, carbs: 3.6,  fat: 0.4,  fiber: 0 },
  { name: 'Cottage Cheese',          calories: 98,  protein: 11.0, carbs: 3.4,  fat: 4.3,  fiber: 0 },
  { name: 'Whey Protein',            calories: 400, protein: 80.0, carbs: 8.0,  fat: 5.0,  fiber: 0 },
  { name: 'Tofu (firm)',             calories: 76,  protein: 8.0,  carbs: 1.9,  fat: 4.8,  fiber: 0.3 },
  { name: 'Lentils (cooked)',        calories: 116, protein: 9.0,  carbs: 20.1, fat: 0.4,  fiber: 7.9 },
  { name: 'Chickpeas (cooked)',      calories: 164, protein: 8.9,  carbs: 27.4, fat: 2.6,  fiber: 7.6 },
  { name: 'Black Beans (cooked)',    calories: 132, protein: 8.9,  carbs: 23.7, fat: 0.5,  fiber: 8.7 },
  { name: 'Edamame',                 calories: 121, protein: 11.9, carbs: 8.9,  fat: 5.2,  fiber: 5.2 },
  // ── Grains & Carbs ───────────────────────────────────────────────────────────
  { name: 'Oats',                    calories: 389, protein: 16.9, carbs: 66.0, fat: 6.9,  fiber: 10.6 },
  { name: 'White Rice (cooked)',     calories: 130, protein: 2.7,  carbs: 28.2, fat: 0.3,  fiber: 0.4 },
  { name: 'Brown Rice',              calories: 111, protein: 2.6,  carbs: 23.0, fat: 0.9,  fiber: 1.8 },
  { name: 'Pasta (cooked)',          calories: 158, protein: 5.8,  carbs: 30.9, fat: 0.9,  fiber: 1.8 },
  { name: 'Whole Wheat Bread',       calories: 247, protein: 13.2, carbs: 41.3, fat: 3.4,  fiber: 6.0 },
  { name: 'White Bread',             calories: 265, protein: 9.0,  carbs: 49.0, fat: 3.2,  fiber: 2.7 },
  { name: 'Quinoa (cooked)',         calories: 120, protein: 4.4,  carbs: 21.3, fat: 1.9,  fiber: 2.8 },
  { name: 'Corn Tortilla',           calories: 218, protein: 5.7,  carbs: 45.9, fat: 2.7,  fiber: 6.3 },
  { name: 'Pita Bread',              calories: 275, protein: 9.1,  carbs: 55.7, fat: 1.2,  fiber: 2.2 },
  { name: 'Sweet Potato',            calories: 86,  protein: 1.6,  carbs: 20.0, fat: 0.1,  fiber: 3.0 },
  { name: 'White Potato (cooked)',   calories: 87,  protein: 1.9,  carbs: 20.1, fat: 0.1,  fiber: 1.8 },
  // ── Fruits ───────────────────────────────────────────────────────────────────
  { name: 'Banana',                  calories: 89,  protein: 1.1,  carbs: 23.0, fat: 0.3,  fiber: 2.6 },
  { name: 'Apple',                   calories: 52,  protein: 0.3,  carbs: 13.8, fat: 0.2,  fiber: 2.4 },
  { name: 'Orange',                  calories: 47,  protein: 0.9,  carbs: 11.8, fat: 0.1,  fiber: 2.4 },
  { name: 'Blueberries',             calories: 57,  protein: 0.7,  carbs: 14.5, fat: 0.3,  fiber: 2.4 },
  { name: 'Strawberries',            calories: 32,  protein: 0.7,  carbs: 7.7,  fat: 0.3,  fiber: 2.0 },
  { name: 'Mango',                   calories: 60,  protein: 0.8,  carbs: 15.0, fat: 0.4,  fiber: 1.6 },
  { name: 'Grapes',                  calories: 69,  protein: 0.7,  carbs: 18.1, fat: 0.2,  fiber: 0.9 },
  // ── Vegetables ───────────────────────────────────────────────────────────────
  { name: 'Broccoli',                calories: 34,  protein: 2.8,  carbs: 7.0,  fat: 0.4,  fiber: 2.6 },
  { name: 'Spinach',                 calories: 23,  protein: 2.9,  carbs: 3.6,  fat: 0.4,  fiber: 2.2 },
  { name: 'Carrot',                  calories: 41,  protein: 0.9,  carbs: 9.6,  fat: 0.2,  fiber: 2.8 },
  { name: 'Avocado',                 calories: 160, protein: 2.0,  carbs: 8.5,  fat: 14.7, fiber: 6.7 },
  { name: 'Tomato',                  calories: 18,  protein: 0.9,  carbs: 3.9,  fat: 0.2,  fiber: 1.2 },
  { name: 'Cucumber',                calories: 15,  protein: 0.7,  carbs: 3.6,  fat: 0.1,  fiber: 0.5 },
  { name: 'Bell Pepper',             calories: 31,  protein: 1.0,  carbs: 6.0,  fat: 0.3,  fiber: 2.1 },
  { name: 'Kale',                    calories: 49,  protein: 4.3,  carbs: 8.8,  fat: 0.9,  fiber: 3.6 },
  // ── Fats & Nuts ──────────────────────────────────────────────────────────────
  { name: 'Olive Oil',               calories: 884, protein: 0.0,  carbs: 0.0,  fat: 100.0, fiber: 0 },
  { name: 'Coconut Oil',             calories: 862, protein: 0.0,  carbs: 0.0,  fat: 100.0, fiber: 0 },
  { name: 'Butter',                  calories: 717, protein: 0.9,  carbs: 0.1,  fat: 81.1, fiber: 0 },
  { name: 'Almonds',                 calories: 579, protein: 21.0, carbs: 22.0, fat: 50.0, fiber: 12.5 },
  { name: 'Peanut Butter',           calories: 588, protein: 25.1, carbs: 20.1, fat: 50.4, fiber: 6.0 },
  { name: 'Walnuts',                 calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2, fiber: 6.7 },
  { name: 'Cashews',                 calories: 553, protein: 18.2, carbs: 30.2, fat: 43.9, fiber: 3.3 },
  // ── Dairy ────────────────────────────────────────────────────────────────────
  { name: 'Whole Milk',              calories: 61,  protein: 3.2,  carbs: 4.8,  fat: 3.3,  fiber: 0 },
  { name: 'Skim Milk',               calories: 34,  protein: 3.4,  carbs: 5.0,  fat: 0.1,  fiber: 0 },
  { name: 'Cheddar Cheese',          calories: 402, protein: 24.9, carbs: 1.3,  fat: 33.1, fiber: 0 },
  { name: 'Mozzarella',              calories: 254, protein: 24.4, carbs: 2.8,  fat: 15.9, fiber: 0 },
  // ── Misc ─────────────────────────────────────────────────────────────────────
  { name: 'Dark Chocolate (70%)',    calories: 598, protein: 7.8,  carbs: 45.9, fat: 42.6, fiber: 10.9 },
  { name: 'Honey',                   calories: 304, protein: 0.3,  carbs: 82.4, fat: 0.0,  fiber: 0.2 },
  { name: 'Protein Bar',             calories: 380, protein: 30.0, carbs: 38.0, fat: 10.0, fiber: 5.0 },
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
    await prisma.food.upsert({
      where:  { name: food.name },
      update: {},
      create: food,
    })
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
