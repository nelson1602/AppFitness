import type { TranslationKey } from '@/shared/localization';
import type { ActivityLevel } from '@/shared/infrastructure/database/types';
import type { BmiCategory } from '@/features/icoach/domain/types';

import type { EquipmentOption, EvaluationStep, FoodMark, InjuryOption } from '../domain/evaluation';
import type { FoodGroupId } from '../domain/food-groups';

/** Literal catalogue keys, so every one is reachable by name (surface-coverage). */
export const STEP_TITLE: Readonly<Record<EvaluationStep, TranslationKey>> = {
  measures: 'evaluation.step.measures',
  health: 'evaluation.step.health',
  food: 'evaluation.step.food',
  lifestyle: 'evaluation.step.lifestyle',
  goal: 'evaluation.step.goal',
  review: 'evaluation.step.review',
};

export const INJURY_LABEL: Readonly<Record<InjuryOption, TranslationKey>> = {
  shoulder: 'evaluation.injury.shoulder',
  knee: 'evaluation.injury.knee',
  lower_back: 'evaluation.injury.lower_back',
  wrist: 'evaluation.injury.wrist',
  elbow: 'evaluation.injury.elbow',
  ankle: 'evaluation.injury.ankle',
  hip: 'evaluation.injury.hip',
  neck: 'evaluation.injury.neck',
  muscle_tear: 'evaluation.injury.muscle_tear',
  shin_splints: 'evaluation.injury.shin_splints',
  plantar_fasciitis: 'evaluation.injury.plantar_fasciitis',
};

export const ACTIVITY_LABEL: Readonly<Record<ActivityLevel, TranslationKey>> = {
  SEDENTARY: 'evaluation.activity.SEDENTARY',
  LIGHT: 'evaluation.activity.LIGHT',
  MODERATE: 'evaluation.activity.MODERATE',
  ACTIVE: 'evaluation.activity.ACTIVE',
  VERY_ACTIVE: 'evaluation.activity.VERY_ACTIVE',
};

export const ACTIVITY_HINT: Readonly<Record<ActivityLevel, TranslationKey>> = {
  SEDENTARY: 'evaluation.activity.SEDENTARY.hint',
  LIGHT: 'evaluation.activity.LIGHT.hint',
  MODERATE: 'evaluation.activity.MODERATE.hint',
  ACTIVE: 'evaluation.activity.ACTIVE.hint',
  VERY_ACTIVE: 'evaluation.activity.VERY_ACTIVE.hint',
};

export const STRESS_LABEL: Readonly<Record<number, TranslationKey>> = {
  '1': 'evaluation.stress.1',
  '2': 'evaluation.stress.2',
  '3': 'evaluation.stress.3',
  '4': 'evaluation.stress.4',
  '5': 'evaluation.stress.5',
};

export const EQUIPMENT_LABEL: Readonly<Record<EquipmentOption, TranslationKey>> = {
  gym: 'evaluation.equipment.gym',
  dumbbell: 'evaluation.equipment.dumbbell',
  band: 'evaluation.equipment.band',
  bodyweight: 'evaluation.equipment.bodyweight',
};

export const SEX_LABEL: Readonly<Record<'FEMALE' | 'MALE', TranslationKey>> = {
  FEMALE: 'evaluation.sex.FEMALE',
  MALE: 'evaluation.sex.MALE',
};

export const BMI_LABEL: Readonly<Record<BmiCategory, TranslationKey>> = {
  UNDERWEIGHT: 'evaluation.bmi.UNDERWEIGHT',
  NORMAL: 'evaluation.bmi.NORMAL',
  OVERWEIGHT: 'evaluation.bmi.OVERWEIGHT',
  OBESE: 'evaluation.bmi.OBESE',
};

export const FOOD_MARK_LABEL: Readonly<Record<FoodMark, TranslationKey>> = {
  allergy: 'evaluation.food.allergy',
  preference: 'evaluation.food.preference',
};

export const FOOD_GROUP_LABEL: Readonly<Record<FoodGroupId, TranslationKey>> = {
  fruits: 'evaluation.foodGroup.fruits',
  vegetables: 'evaluation.foodGroup.vegetables',
  meat: 'evaluation.foodGroup.meat',
  seafood: 'evaluation.foodGroup.seafood',
  dairy: 'evaluation.foodGroup.dairy',
  grains: 'evaluation.foodGroup.grains',
  legumes: 'evaluation.foodGroup.legumes',
  nuts: 'evaluation.foodGroup.nuts',
  roots: 'evaluation.foodGroup.roots',
  other: 'evaluation.foodGroup.other',
};

export const FOOD_ITEM_LABEL: Readonly<Record<string, TranslationKey>> = {
  banana: 'evaluation.food.item.banana',
  apple: 'evaluation.food.item.apple',
  strawberries: 'evaluation.food.item.strawberries',
  blueberries: 'evaluation.food.item.blueberries',
  pineapple: 'evaluation.food.item.pineapple',
  papaya: 'evaluation.food.item.papaya',
  mango: 'evaluation.food.item.mango',
  orange: 'evaluation.food.item.orange',
  watermelon: 'evaluation.food.item.watermelon',
  kiwi: 'evaluation.food.item.kiwi',
  grapes: 'evaluation.food.item.grapes',
  passion_fruit: 'evaluation.food.item.passion_fruit',
  broccoli: 'evaluation.food.item.broccoli',
  spinach: 'evaluation.food.item.spinach',
  lettuce: 'evaluation.food.item.lettuce',
  tomato: 'evaluation.food.item.tomato',
  peppers: 'evaluation.food.item.peppers',
  carrot: 'evaluation.food.item.carrot',
  cucumber: 'evaluation.food.item.cucumber',
  cauliflower: 'evaluation.food.item.cauliflower',
  eggplant: 'evaluation.food.item.eggplant',
  onion: 'evaluation.food.item.onion',
  pumpkin: 'evaluation.food.item.pumpkin',
  chicken: 'evaluation.food.item.chicken',
  turkey: 'evaluation.food.item.turkey',
  beef: 'evaluation.food.item.beef',
  pork: 'evaluation.food.item.pork',
  fish: 'evaluation.food.item.fish',
  tuna: 'evaluation.food.item.tuna',
  salmon: 'evaluation.food.item.salmon',
  egg: 'evaluation.food.item.egg',
  shrimp: 'evaluation.food.item.shrimp',
  lobster: 'evaluation.food.item.lobster',
  crab: 'evaluation.food.item.crab',
  octopus: 'evaluation.food.item.octopus',
  conch: 'evaluation.food.item.conch',
  clams_mussels: 'evaluation.food.item.clams_mussels',
  milk: 'evaluation.food.item.milk',
  yogurt: 'evaluation.food.item.yogurt',
  cheese: 'evaluation.food.item.cheese',
  whey: 'evaluation.food.item.whey',
  butter: 'evaluation.food.item.butter',
  wheat: 'evaluation.food.item.wheat',
  pasta: 'evaluation.food.item.pasta',
  oats: 'evaluation.food.item.oats',
  barley: 'evaluation.food.item.barley',
  rye: 'evaluation.food.item.rye',
  rice: 'evaluation.food.item.rice',
  quinoa: 'evaluation.food.item.quinoa',
  corn: 'evaluation.food.item.corn',
  beans: 'evaluation.food.item.beans',
  lentils: 'evaluation.food.item.lentils',
  chickpeas: 'evaluation.food.item.chickpeas',
  pigeon_peas: 'evaluation.food.item.pigeon_peas',
  soy: 'evaluation.food.item.soy',
  peanut: 'evaluation.food.item.peanut',
  almonds: 'evaluation.food.item.almonds',
  walnuts: 'evaluation.food.item.walnuts',
  cashews: 'evaluation.food.item.cashews',
  pistachios: 'evaluation.food.item.pistachios',
  sesame: 'evaluation.food.item.sesame',
  chia: 'evaluation.food.item.chia',
  flax: 'evaluation.food.item.flax',
  plantain: 'evaluation.food.item.plantain',
  cassava: 'evaluation.food.item.cassava',
  sweet_potato: 'evaluation.food.item.sweet_potato',
  potato: 'evaluation.food.item.potato',
  yam: 'evaluation.food.item.yam',
  yautia: 'evaluation.food.item.yautia',
  high_sodium: 'evaluation.food.item.high_sodium',
  high_purine: 'evaluation.food.item.high_purine',
  added_sugar: 'evaluation.food.item.added_sugar',
  alcohol: 'evaluation.food.item.alcohol',
  caffeine: 'evaluation.food.item.caffeine',
  fried: 'evaluation.food.item.fried',
};

export function foodLabelKey(id: string): TranslationKey {
  const key = FOOD_ITEM_LABEL[id];
  if (!key) throw new Error(`Unknown food item ${id}`);
  return key;
}
