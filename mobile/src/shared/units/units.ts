import { formatQuantity, type SupportedLanguage } from '@/shared/localization';

/**
 * Display units (v10 Block C, item 9). Every value is stored and computed in
 * metric (kg, cm); the person's choice only changes how a value is shown and
 * how a typed value is read. Conversions are exact by definition.
 */
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];
export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric';
export const UNIT_SYSTEM_STORAGE_KEY = 'appfitness.unit-system';

export function isUnitSystem(value: string | null): value is UnitSystem {
  return value === 'metric' || value === 'imperial';
}

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
const IN_PER_FT = 12;

export type WeightUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';

export function weightUnit(system: UnitSystem): WeightUnit {
  return system === 'imperial' ? 'lb' : 'kg';
}

export function lengthUnit(system: UnitSystem): LengthUnit {
  return system === 'imperial' ? 'in' : 'cm';
}

/**
 * v11-B: weight and height are chosen apart (lb + cm is valid). Body lengths
 * (waist, hips, chest) follow the height unit. Stored values stay metric.
 */
export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export const HEIGHT_UNITS = ['cm', 'ft-in'] as const;
export type HeightUnit = (typeof HEIGHT_UNITS)[number];
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kg';
export const DEFAULT_HEIGHT_UNIT: HeightUnit = 'cm';
export const WEIGHT_UNIT_STORAGE_KEY = 'appfitness.weight-unit';
export const HEIGHT_UNIT_STORAGE_KEY = 'appfitness.height-unit';

export function isWeightUnit(value: string | null): value is WeightUnit {
  return value === 'kg' || value === 'lb';
}

export function isHeightUnit(value: string | null): value is HeightUnit {
  return value === 'cm' || value === 'ft-in';
}

/** The conversion system a weight unit reads and writes with. */
export function weightSystemOf(unit: WeightUnit): UnitSystem {
  return unit === 'lb' ? 'imperial' : 'metric';
}

/** The conversion system a height unit (and every body length) uses. */
export function lengthSystemOf(unit: HeightUnit): UnitSystem {
  return unit === 'ft-in' ? 'imperial' : 'metric';
}

export interface UnitPreferences {
  weight: WeightUnit;
  height: HeightUnit;
}

/** The v10 single choice, migrated: imperial → lb + ft-in, metric → kg + cm. */
export function preferencesFromSystem(system: UnitSystem): UnitPreferences {
  return system === 'imperial' ? { weight: 'lb', height: 'ft-in' } : { weight: 'kg', height: 'cm' };
}

/** A form's units: one system for both, or weight and length apart. */
export type UnitPair = { weight: UnitSystem; length: UnitSystem };

export function unitPair(units: UnitSystem | UnitPair): UnitPair {
  return typeof units === 'string' ? { weight: units, length: units } : units;
}

/** A stored kg value in the person's unit. */
export function kgToDisplay(kg: number, system: UnitSystem): number {
  return system === 'imperial' ? kg / KG_PER_LB : kg;
}

/** A typed weight, in the person's unit, back to kg for storage. */
export function displayToKg(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * KG_PER_LB : value;
}

/** A stored cm length (waist, hips...) in the person's unit. */
export function cmToDisplay(cm: number, system: UnitSystem): number {
  return system === 'imperial' ? cm / CM_PER_IN : cm;
}

/** A typed length, in the person's unit, back to cm for storage. */
export function displayToCm(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * CM_PER_IN : value;
}

/** A height in whole feet and inches: 170 cm → 5 ft 7 in (never "5 ft 12 in"). */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_IN);
  return { feet: Math.floor(total / IN_PER_FT), inches: total % IN_PER_FT };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * IN_PER_FT + inches) * CM_PER_IN;
}

/** Rounds to one decimal, the precision every weight and length is shown at. */
export function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

interface FormatOptions {
  maximumFractionDigits?: number;
}

/** "72 kg" / "158,7 lb" — value and unit joined by a no-break space. */
export function formatWeight(
  kg: number,
  system: UnitSystem,
  language: SupportedLanguage,
  { maximumFractionDigits = 1 }: FormatOptions = {},
): string {
  return formatQuantity(kgToDisplay(kg, system), weightUnit(system), language, {
    maximumFractionDigits,
  });
}

/** A body length (waist, hips, chest): "86 cm" / "33,9 in". */
export function formatLength(cm: number, system: UnitSystem, language: SupportedLanguage): string {
  return formatQuantity(cmToDisplay(cm, system), lengthUnit(system), language, {
    maximumFractionDigits: 1,
  });
}

/** A height: "170 cm" / "5 ft 7 in". */
export function formatHeight(cm: number, system: UnitSystem, language: SupportedLanguage): string {
  if (system === 'metric') return formatQuantity(cm, 'cm', language, { maximumFractionDigits: 1 });
  const { feet, inches } = cmToFeetInches(cm);
  return `${formatQuantity(feet, 'ft', language)} ${formatQuantity(inches, 'in', language)}`;
}

/** A number as a field holds it: "82,5" in Spanish, "82.5" in English, no grouping. */
function fieldDecimal(value: number, language: SupportedLanguage): string {
  const text = String(value);
  return language === 'es' ? text.replace('.', ',') : text;
}

/**
 * A weight as the text a field starts with, or "" when unknown. Metric shows
 * the stored value as typed; a converted value is rounded to 0.1 ("159,8").
 */
export function weightFieldText(
  kg: number | null | undefined,
  system: UnitSystem,
  language: SupportedLanguage,
): string {
  if (kg === null || kg === undefined) return '';
  return fieldDecimal(system === 'metric' ? kg : roundToTenth(kgToDisplay(kg, system)), language);
}

/** A body length as the text a field starts with, in the person's unit. */
export function lengthFieldText(
  cm: number | null | undefined,
  system: UnitSystem,
  language: SupportedLanguage,
): string {
  if (cm === null || cm === undefined) return '';
  return fieldDecimal(system === 'metric' ? cm : roundToTenth(cmToDisplay(cm, system)), language);
}

/**
 * A typed decimal ("72,5" or "72.5") as a number, or null when it is not one.
 * The same rule as the evaluation fields, so every unit field reads alike.
 */
export function parseFieldDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized) && !/^\d+\.$/.test(normalized)) return null;
  const value = Number(normalized.replace(/\.$/, ''));
  return Number.isFinite(value) ? value : null;
}
