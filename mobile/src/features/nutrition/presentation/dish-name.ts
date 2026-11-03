import type { TranslationKey } from '@/shared/localization';

/**
 * Presentation names of the Dominican dishes (v8.1, meal-rules@1.5.0). The
 * generator stores a dish id and its `nutrition.dish.<id>` key in the plan; the
 * screens resolve it here, so every key is named literally and a saved key
 * the app no longer ships resolves to null (render the ingredients only).
 * meal-rules@1.6.0 replaced four dishes; their keys stay (marked below) so a
 * week saved before the update keeps its names.
 */
const DISH_NAME_KEY: Readonly<Record<string, TranslationKey>> = {
  mangu_huevo_aguacate: 'nutrition.dish.mangu_huevo_aguacate',
  avena_guineo_canela: 'nutrition.dish.avena_guineo_canela',
  pan_queso_blanco_tomate: 'nutrition.dish.pan_queso_blanco_tomate',
  batata_huevos_revueltos: 'nutrition.dish.batata_huevos_revueltos',
  yogur_fresas_almendras: 'nutrition.dish.yogur_fresas_almendras',
  yuca_huevo_aguacate: 'nutrition.dish.yuca_huevo_aguacate',
  mangu_huevo_queso_blanco: 'nutrition.dish.mangu_huevo_queso_blanco',
  tortilla_espinaca_pan: 'nutrition.dish.tortilla_espinaca_pan',
  name_huevo_tomate: 'nutrition.dish.name_huevo_tomate',
  yautia_huevo_cebolla: 'nutrition.dish.yautia_huevo_cebolla',
  pan_huevo_aguacate: 'nutrition.dish.pan_huevo_aguacate',
  yogur_lechosa_avena: 'nutrition.dish.yogur_lechosa_avena',
  locrio_pollo_ensalada: 'nutrition.dish.locrio_pollo_ensalada',
  moro_habichuelas_pechuga: 'nutrition.dish.moro_habichuelas_pechuga',
  arroz_camarones_vegetales: 'nutrition.dish.arroz_camarones_vegetales',
  pescado_platano_ensalada: 'nutrition.dish.pescado_platano_ensalada',
  sancocho_ligero_pollo: 'nutrition.dish.sancocho_ligero_pollo',
  moro_guandules_pollo: 'nutrition.dish.moro_guandules_pollo',
  la_bandera: 'nutrition.dish.la_bandera',
  lambi_guisado_arroz: 'nutrition.dish.lambi_guisado_arroz',
  pollo_horno_batata_repollo: 'nutrition.dish.pollo_horno_batata_repollo',
  arroz_integral_habichuelas_aguacate: 'nutrition.dish.arroz_integral_habichuelas_aguacate',
  bacalao_guisado_yuca: 'nutrition.dish.bacalao_guisado_yuca',
  chuleta_moro_negro: 'nutrition.dish.chuleta_moro_negro',
  pechuga_pure_yuca: 'nutrition.dish.pechuga_pure_yuca',
  ensalada_atun_aguacate: 'nutrition.dish.ensalada_atun_aguacate',
  camarones_ajillo_arroz_integral: 'nutrition.dish.camarones_ajillo_arroz_integral',
  tortilla_vegetales_casabe: 'nutrition.dish.tortilla_vegetales_casabe',
  yuca_huevo_queso_blanco: 'nutrition.dish.yuca_huevo_queso_blanco',
  salmon_batata_vegetales: 'nutrition.dish.salmon_batata_vegetales',
  pavo_pure_batata: 'nutrition.dish.pavo_pure_batata',
  pescado_horno_name: 'nutrition.dish.pescado_horno_name',
  wrap_pollo_vegetales: 'nutrition.dish.wrap_pollo_vegetales',
  res_salteada_arroz_integral: 'nutrition.dish.res_salteada_arroz_integral',
  crema_auyama_pollo: 'nutrition.dish.crema_auyama_pollo',
  langosta_batata_ensalada: 'nutrition.dish.langosta_batata_ensalada',
  almejas_guisadas_arroz: 'nutrition.dish.almejas_guisadas_arroz',
  pina_chia: 'nutrition.dish.pina_chia',
  batida_lechosa_leche: 'nutrition.dish.batida_lechosa_leche',
  guineo_mantequilla_mani: 'nutrition.dish.guineo_mantequilla_mani',
  casabe_aguacate: 'nutrition.dish.casabe_aguacate',
  batida_avena_canela: 'nutrition.dish.batida_avena_canela',
  nueces_pasas: 'nutrition.dish.nueces_pasas',
  yogur_mango: 'nutrition.dish.yogur_mango',
  manzana_mantequilla_mani: 'nutrition.dish.manzana_mantequilla_mani',
  naranja_mani: 'nutrition.dish.naranja_mani',
  batida_guineo_avena: 'nutrition.dish.batida_guineo_avena',
  // Replaced in meal-rules@1.6.0; kept for weeks saved before the update.
  avena_guineo_chia: 'nutrition.dish.avena_guineo_chia',
  pan_queso_tomate: 'nutrition.dish.pan_queso_tomate',
  tortilla_vegetales_yuca: 'nutrition.dish.tortilla_vegetales_yuca',
  tortitas_arroz_aguacate: 'nutrition.dish.tortitas_arroz_aguacate',
};

/** The ingredient mark for a food the iCoach swapped into a dish. */
export const SWAP_MARK_KEY: TranslationKey = 'nutrition.plan.swapMark';

/** The translation key of a dish id, or null for an unknown id. */
export function dishNameKeyFor(dishId: string | undefined): TranslationKey | null {
  return dishId !== undefined && Object.prototype.hasOwnProperty.call(DISH_NAME_KEY, dishId)
    ? DISH_NAME_KEY[dishId]
    : null;
}
