import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import { NEVER_PLANNED_TAGS } from '../application/meal-portions';
import { FOOD_CATALOG } from '../infrastructure/food-catalog.data';
import { dishNameKeyFor, SWAP_MARK_KEY } from '../presentation/dish-name';
import {
  adaptDish,
  DISH_SWAP_POOLS,
  dishAvoidTags,
  dishesForSlot,
  dishMacros,
  dishNameKey,
  DOMINICAN_DISHES,
  type Dish,
} from './dominican-dishes';
import type { FoodId, FoodItem } from './food-catalog';

const byId = new Map(FOOD_CATALOG.map((food) => [food.id, food]));
const lookup = (id: FoodId): FoodItem | undefined => byId.get(id);
const kcal = (id: FoodId): number => byId.get(id)?.calories ?? Number.NaN;
const dish = (id: string): Dish => {
  const found = DOMINICAN_DISHES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no dish ${id}`);
  return found;
};
const blockedBy =
  (keys: readonly string[] = [], tags: readonly string[] = []) =>
  (id: FoodId): boolean =>
    keys.includes(id) || (byId.get(id)?.avoidFor ?? []).some((tag) => tags.includes(tag));

/** The prototype's MEALS (docs/design/appfitnessrd-prototipo.html), by catalogue id. */
const PROTOTYPE_DISHES = [
  'mangu_huevo_aguacate',
  'avena_guineo_canela',
  'pan_queso_blanco_tomate',
  'batata_huevos_revueltos',
  'yogur_fresas_almendras',
  'locrio_pollo_ensalada',
  'moro_habichuelas_pechuga',
  'arroz_camarones_vegetales',
  'pescado_platano_ensalada',
  'sancocho_ligero_pollo',
  'pina_chia',
  'batida_lechosa_leche',
  'guineo_mantequilla_mani',
  'casabe_aguacate',
  'nueces_pasas',
  'pechuga_pure_yuca',
  'ensalada_atun_aguacate',
  'camarones_ajillo_arroz_integral',
  'tortilla_vegetales_casabe',
  'salmon_batata_vegetales',
];

/** The Dominican foods seeded by ADR-P040 D10 that a plan can propose (not fried, not soda). */
const DOMINICAN_SEED_FOODS = [
  'food.plantain_boiled',
  'food.cassava_cooked',
  'food.yam_cooked',
  'food.yautia_raw',
  'food.pigeon_peas',
  'food.conch',
  'food.clams',
  'food.lobster',
];

describe('the Dominican dish catalogue (v8.1)', () => {
  it('has enough dishes per meal for variety around the everyday dishes', () => {
    expect(dishesForSlot('BREAKFAST').length).toBeGreaterThanOrEqual(10);
    expect(dishesForSlot('LUNCH').length).toBeGreaterThanOrEqual(10);
    expect(dishesForSlot('DINNER').length).toBeGreaterThanOrEqual(10);
    expect(dishesForSlot('SNACK').length).toBeGreaterThanOrEqual(8);
    for (const slot of ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const) {
      expect(Math.ceil(15 / dishesForSlot(slot).length)).toBeLessThanOrEqual(2);
    }
  });

  it('includes every prototype dish, with unique ids', () => {
    const ids = DOMINICAN_DISHES.map((candidate) => candidate.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(PROTOTYPE_DISHES));
  });

  it('builds every dish from catalog foods only — never fried, sugary or alcoholic', () => {
    for (const candidate of DOMINICAN_DISHES) {
      for (const line of candidate.lines) {
        const food = byId.get(line.food);
        expect({ dish: candidate.id, food: line.food, found: food !== undefined }).toEqual({
          dish: candidate.id,
          food: line.food,
          found: true,
        });
        expect(food?.avoidFor ?? []).toEqual(expect.not.arrayContaining([...NEVER_PLANNED_TAGS]));
        expect(line.servings).toBeGreaterThan(0);
        for (const alternative of line.alternatives ?? []) expect(byId.has(alternative)).toBe(true);
      }
    }
    for (const pool of Object.values(DISH_SWAP_POOLS)) {
      for (const id of pool) {
        expect(byId.has(id)).toBe(true);
        expect(byId.get(id)?.avoidFor ?? []).toEqual(
          expect.not.arrayContaining([...NEVER_PLANNED_TAGS]),
        );
      }
    }
  });

  it('marks everyday dishes in every meal, with other dishes left for variety', () => {
    for (const slot of ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const) {
      const dishes = dishesForSlot(slot);
      // Two or more, so the everyday run never repeats a dish on consecutive days.
      expect(dishes.filter((d) => d.everyday).length).toBeGreaterThanOrEqual(2);
      expect(dishes.filter((d) => !d.everyday).length).toBeGreaterThanOrEqual(1);
    }
    const everyday = DOMINICAN_DISHES.filter((d) => d.everyday).map((d) => d.id);
    expect(everyday).toEqual(
      expect.arrayContaining([
        'mangu_huevo_aguacate',
        'avena_guineo_canela',
        'la_bandera',
        'locrio_pollo_ensalada',
        'moro_habichuelas_pechuga',
        'sancocho_ligero_pollo',
        'yuca_huevo_aguacate',
        'casabe_aguacate',
        'pan_queso_blanco_tomate',
      ]),
    );
  });

  it('cooks with casabe, queso blanco and canela instead of a nearest-food stand-in', () => {
    const foodsOf = (id: string) => dish(id).lines.map((l) => l.food);
    expect(foodsOf('casabe_aguacate')).toContain('food.casabe');
    expect(foodsOf('tortilla_vegetales_casabe')).toContain('food.casabe');
    expect(foodsOf('pan_queso_blanco_tomate')).toContain('food.queso_blanco');
    expect(foodsOf('mangu_huevo_queso_blanco')).toContain('food.queso_blanco');
    expect(foodsOf('avena_guineo_canela')).toContain('food.cinnamon_ground');
    expect(foodsOf('batida_avena_canela')).toContain('food.cinnamon_ground');
    // The old stand-ins are only substitutes now, never a dish's own line.
    const lines = DOMINICAN_DISHES.flatMap((d) => d.lines.map((l) => l.food));
    expect(lines).not.toContain('food.rice_cakes');
    expect(lines).not.toContain('food.mozzarella_part_skim');
  });

  it('reuses the Dominican foods seeded for the evaluation', () => {
    const used = new Set(
      DOMINICAN_DISHES.flatMap((candidate) => candidate.lines.map((l) => l.food)),
    );
    for (const food of DOMINICAN_SEED_FOODS) expect(used).toContain(food);
  });

  it('gives main meals at least three foods to portion, so no food has to carry 40 %', () => {
    for (const candidate of DOMINICAN_DISHES.filter((d) => d.slot !== 'SNACK')) {
      expect(candidate.lines.filter((line) => !line.seasoning).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('names every dish in Spanish and English', () => {
    for (const candidate of DOMINICAN_DISHES) {
      const key = dishNameKey(candidate.id) as keyof typeof en;
      expect(key).toBe(`nutrition.dish.${candidate.id}`);
      expect(en[key]).toBeTruthy();
      expect(es[key]).toBeTruthy();
    }
    expect(es['nutrition.dish.mangu_huevo_aguacate']).toBe('Mangú con huevo y aguacate');
  });

  it('computes nutrition from the catalog rather than authoring it', () => {
    const mangu = dishMacros(dish('mangu_huevo_aguacate'), lookup);
    const expected =
      2 * kcal('food.plantain_boiled') +
      2 * kcal('food.egg_whole') +
      0.75 * kcal('food.avocado_half') +
      0.25 * kcal('food.onion');
    expect(mangu.calories).toBeCloseTo(expected, 6);
    expect(mangu.proteinG).toBeGreaterThan(0);
  });

  it('derives allergen and avoid tags from the foods', () => {
    expect(dishAvoidTags(dish('arroz_camarones_vegetales'), lookup)).toEqual([
      'high_purine',
      'shellfish_allergy',
    ]);
    expect(dishAvoidTags(dish('yogur_fresas_almendras'), lookup)).toEqual([
      'lactose_sensitive',
      'nut_allergy',
    ]);
    expect(dishAvoidTags(dish('mangu_huevo_aguacate'), lookup)).toEqual([]);
  });
});

describe('adaptDish — only the excluded ingredient changes (ADR-P040 D3)', () => {
  it('keeps a dish with nothing excluded exactly as it is', () => {
    const adapted = adaptDish(dish('mangu_huevo_aguacate'), blockedBy(), lookup);
    expect(adapted.adjustments).toEqual([]);
    expect(adapted.lines).toEqual(dish('mangu_huevo_aguacate').lines);
  });

  it('swaps an allergen for the first same-role food, in the same calories', () => {
    const adapted = adaptDish(
      dish('arroz_camarones_vegetales'),
      blockedBy([], ['shellfish_allergy']),
      lookup,
    );
    expect(adapted.adjustments).toEqual([{ from: 'food.shrimp', to: 'food.chicken_breast' }]);
    const swapped = adapted.lines.find((line) => line.swappedFrom === 'food.shrimp');
    expect(swapped).toMatchObject({ food: 'food.chicken_breast', role: 'protein' });
    // 1.5 × 105 kcal of shrimp ≈ 1 × 160 kcal of chicken, in 0.25 steps.
    expect(swapped?.servings).toBe(1);
    // The dish keeps its other lines, in order.
    expect(adapted.lines.map((line) => line.food)).toEqual([
      'food.white_rice',
      'food.chicken_breast',
      'food.olive_oil',
      'food.corn',
      'food.bell_pepper_red',
    ]);
  });

  it("tries the line's own alternatives first (yogurt → soy yogurt, almonds → pumpkin seeds)", () => {
    const adapted = adaptDish(
      dish('yogur_fresas_almendras'),
      blockedBy([], ['lactose_sensitive', 'nut_allergy']),
      lookup,
    );
    expect(adapted.adjustments).toEqual([
      { from: 'food.greek_yogurt_nonfat', to: 'food.soy_yogurt_plain' },
      { from: 'food.almonds', to: 'food.pumpkin_seeds' },
    ]);
  });

  it('never picks a substitute that is already in the dish', () => {
    // The tuna salad already has avocado, so olive oil becomes canola oil.
    const adapted = adaptDish(
      dish('ensalada_atun_aguacate'),
      blockedBy(['food.olive_oil']),
      lookup,
    );
    expect(adapted.adjustments).toEqual([{ from: 'food.olive_oil', to: 'food.canola_oil' }]);
  });

  it('matches by catalog key and tag, never by name (excluding egg whites keeps whole eggs)', () => {
    const adapted = adaptDish(
      dish('batata_huevos_revueltos'),
      blockedBy(['food.egg_white']),
      lookup,
    );
    expect(adapted.lines.map((line) => line.food)).toContain('food.egg_whole');
    expect(adapted.adjustments).toEqual([{ from: 'food.egg_white', to: 'food.chicken_breast' }]);
  });

  it('leaves a seasoning out instead of substituting it ("sin ajo")', () => {
    const adapted = adaptDish(
      dish('camarones_ajillo_arroz_integral'),
      blockedBy(['food.garlic']),
      lookup,
    );
    expect(adapted.adjustments).toEqual([{ from: 'food.garlic', to: null }]);
    expect(adapted.lines.map((line) => line.food)).not.toContain('food.garlic');
  });

  it('leaves the ingredient out when no food of its role is left', () => {
    const everyFat = [...DISH_SWAP_POOLS.fat, 'food.peanut_butter', 'food.sunflower_butter'];
    const adapted = adaptDish(dish('guineo_mantequilla_mani'), blockedBy(everyFat), lookup);
    expect(adapted.adjustments).toEqual([{ from: 'food.peanut_butter', to: null }]);
    expect(adapted.lines.map((line) => line.food)).toEqual(['food.banana']);
  });

  it('swaps queso blanco and casabe for the closest food the person can have', () => {
    // Lactose: mozzarella is dairy too, so tofu; sodium only: mozzarella keeps a cheese.
    expect(
      adaptDish(dish('pan_queso_blanco_tomate'), blockedBy([], ['lactose_sensitive']), lookup)
        .adjustments,
    ).toEqual([{ from: 'food.queso_blanco', to: 'food.tofu_firm' }]);
    expect(
      adaptDish(dish('pan_queso_blanco_tomate'), blockedBy([], ['high_sodium_sensitive']), lookup)
        .adjustments,
    ).toEqual([{ from: 'food.queso_blanco', to: 'food.mozzarella_part_skim' }]);
    // Casabe (salted cassava bread) becomes boiled cassava; the dish stays.
    const adapted = adaptDish(
      dish('casabe_aguacate'),
      blockedBy([], ['high_sodium_sensitive']),
      lookup,
    );
    expect(adapted.dish.id).toBe('casabe_aguacate');
    expect(adapted.adjustments).toEqual([{ from: 'food.casabe', to: 'food.cassava_cooked' }]);
  });

  it('leaves the cinnamon out rather than substituting it ("sin canela")', () => {
    const adapted = adaptDish(
      dish('avena_guineo_canela'),
      blockedBy(['food.cinnamon_ground']),
      lookup,
    );
    expect(adapted.adjustments).toEqual([{ from: 'food.cinnamon_ground', to: null }]);
  });

  it('is deterministic', () => {
    const run = () =>
      adaptDish(dish('la_bandera'), blockedBy(['food.kidney_beans', 'food.beef_sirloin']), lookup);
    expect(run()).toEqual(run());
    expect(run().adjustments).toEqual([
      { from: 'food.kidney_beans', to: 'food.pigeon_peas' },
      { from: 'food.beef_sirloin', to: 'food.chicken_breast' },
    ]);
  });
});

describe('dish names for the screens', () => {
  it('resolves every catalogue dish to its name key, and an unknown id to null', () => {
    for (const candidate of DOMINICAN_DISHES) {
      expect(dishNameKeyFor(candidate.id)).toBe(dishNameKey(candidate.id));
    }
    // Dishes replaced in meal-rules@1.6.0 keep their names for weeks saved before it.
    for (const legacy of [
      'avena_guineo_chia',
      'pan_queso_tomate',
      'tortilla_vegetales_yuca',
      'tortitas_arroz_aguacate',
    ]) {
      expect(DOMINICAN_DISHES.some((d) => d.id === legacy)).toBe(false);
      const key = dishNameKeyFor(legacy);
      expect(key).toBe(`nutrition.dish.${legacy}`);
      expect(es[key as keyof typeof es]).toBeTruthy();
      expect(en[key as keyof typeof en]).toBeTruthy();
    }
    expect(dishNameKeyFor('no_such_dish')).toBeNull();
    expect(dishNameKeyFor(undefined)).toBeNull();
    expect(dishNameKeyFor('toString')).toBeNull();
    expect(es[SWAP_MARK_KEY]).toBe('(cambio del iCoach)');
  });
});
