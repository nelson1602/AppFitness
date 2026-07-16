import { getSession } from '../../authentication';
import type { DietaryPreference, DietaryPreferenceInput } from '../domain/dietary-preference';
import {
  createDietaryPreference,
  deleteDietaryPreference,
  listActiveDietaryPreferences,
} from '../infrastructure/dietary-preference.repository';

/**
 * Dietary-preference use cases (ADR-P014 Slice 2A). Stores/UI call these,
 * never SQLite or crypto directly. The current user is resolved from the
 * session here — never passed by callers. No meal-plan/food-log consumption
 * yet (Slices 3/4).
 */

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

export function addDietaryPreference(input: DietaryPreferenceInput): Promise<DietaryPreference> {
  return createDietaryPreference(requireUserId(), input);
}

export function getMyDietaryPreferences(): Promise<DietaryPreference[]> {
  return listActiveDietaryPreferences(requireUserId());
}

export function removeDietaryPreference(id: string): Promise<void> {
  return deleteDietaryPreference(requireUserId(), id);
}
