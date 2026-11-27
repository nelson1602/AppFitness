/**
 * Spanish/Dominican search aliases for bundled foods (ADR-P045 Amendment
 * BUG-057). A word people type that is in no catalogue name ("mangú",
 * "habichuelas") finds the bundled food it means.
 *
 * - Search only: what is stored and what is shown never change.
 * - Keys are folded: accent-free, lower-case, single spaces.
 * - Values are bundled catalogue ids; several equal matches keep the
 *   catalogue order.
 * - Extending the table is a reviewed code change. An alias never points at a
 *   near-miss: a food with no bundled match waits for a sourced catalogue
 *   entry (FEATURE-021).
 */
export const FOOD_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // Mashed boiled green plantain; the plan's mangú dishes use this food.
  // Repoint to the bundled mangú once FEATURE-021 adds it.
  mangu: ['food.plantain_boiled'],
  habichuela: ['food.kidney_beans'],
  habichuelas: ['food.kidney_beans'],
  'habichuelas negras': ['food.black_beans'],
  'habichuelas blancas': ['food.navy_beans'],
  gandul: ['food.pigeon_peas'],
  gandules: ['food.pigeon_peas'],
  guineo: ['food.banana'],
  lechosa: ['food.papaya'],
  chinola: ['food.passion_fruit'],
  molondron: ['food.okra'],
  auyama: ['food.pumpkin'],
  aji: ['food.bell_pepper_green', 'food.bell_pepper_red'],
  'aji morron': ['food.bell_pepper_green', 'food.bell_pepper_red'],
};
