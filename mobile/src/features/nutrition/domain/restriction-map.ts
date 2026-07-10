import type { AvoidTag } from './food-catalog';
import type { RestrictionRef } from './meal-plan';

/**
 * Best-effort mapping from the CURRENT active-restriction model to catalog
 * `avoidFor` tags (Phase 15 Slice 3A).
 *
 * The current model — INJURY / CONDITION / DOCTOR_RESTRICTION with an
 * optional bodyArea/severity — carries NO structured dietary or allergy
 * signal, so nothing maps cleanly to a food `avoidFor` tag (nut_allergy,
 * shellfish_allergy, gluten_sensitive, lactose_sensitive,
 * high_sodium_sensitive, high_purine). This therefore returns an empty set
 * for every current restriction.
 *
 * It is the documented integration point: when a dietary-preference /
 * allergy data source exists (deferred — no profile field/schema yet), the
 * mapping is extended here and the generator's exclusion behavior applies
 * automatically. Callers/tests can also pass explicit exclusions via
 * `MealPlanInput.excludeAvoidTags`.
 */
export function restrictionsToAvoidTags(restrictions: readonly RestrictionRef[]): AvoidTag[] {
  // Intentionally derives nothing from the current structured model; see the
  // doc comment. `restrictions` is referenced so future mappings slot in here.
  void restrictions;
  return [];
}
