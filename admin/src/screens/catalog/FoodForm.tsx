import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { SERVING_UNITS } from '../../api/types';
import type { CatalogFoodInput, CatalogFoodView } from '../../api/types';
import { ErrorText } from '../../components/Banner';
import { es } from '../../i18n/es';
import { catalogErrorMessage, isServingUnit } from './catalogFormat';

const TEXT_MAX = 80;
const PORTION_MAX = 5000;
const CALORIES_MAX = 10000;
const MACRO_MAX = 1000;

export interface FoodFormValues {
  name: string;
  brand: string;
  servingAmount: string;
  servingUnit: string;
  gramsPerServing: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

const EMPTY: FoodFormValues = {
  name: '',
  brand: '',
  servingAmount: '',
  servingUnit: '',
  gramsPerServing: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
};

const text = (value: number | null) => (value === null ? '' : String(value));

export function toFormValues(food: CatalogFoodView): FoodFormValues {
  return {
    name: food.name,
    brand: food.brand ?? '',
    servingAmount: String(food.servingAmount),
    servingUnit: isServingUnit(food.servingUnit) ? food.servingUnit : '',
    gramsPerServing: text(food.gramsPerServing),
    calories: String(food.caloriesPerServing),
    protein: String(food.proteinPerServing),
    carbs: String(food.carbsPerServing),
    fat: String(food.fatPerServing),
    fiber: text(food.fiberPerServing),
  };
}

interface NumberRule {
  label: string;
  max: number;
  /** `true`: must be > 0; otherwise >= 0. */
  positive?: boolean;
}

type Parsed = { ok: true; value: number | undefined } | { ok: false };

function parseNumber(raw: string, rule: NumberRule, optional: boolean): Parsed {
  const trimmed = raw.trim();
  if (!trimmed)
    return optional ? { ok: true, value: undefined } : { ok: false };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value > rule.max) return { ok: false };
  if (rule.positive ? value <= 0 : value < 0) return { ok: false };
  return { ok: true, value };
}

function numberError(rule: NumberRule): string {
  return rule.positive
    ? es.catalog.form.positive(rule.label, rule.max)
    : es.catalog.form.range(rule.label, 0, rule.max);
}

export type FoodValidation =
  { ok: true; input: CatalogFoodInput } | { ok: false; error: string };

/** Mirrors the server's field limits. Empty optional fields are omitted. */
export function validateFood(values: FoodFormValues): FoodValidation {
  const f = es.catalog.form;
  const name = values.name.trim();
  if (name.length < 1 || name.length > TEXT_MAX) {
    return { ok: false, error: f.textLength(f.name, TEXT_MAX) };
  }
  const brand = values.brand.trim();
  if (brand.length > TEXT_MAX) {
    return { ok: false, error: f.textLength(f.brand, TEXT_MAX) };
  }
  if (!isServingUnit(values.servingUnit)) {
    return { ok: false, error: f.unitRequired };
  }

  const fields: [keyof FoodFormValues, NumberRule, boolean][] = [
    [
      'servingAmount',
      { label: f.servingAmount, max: PORTION_MAX, positive: true },
      false,
    ],
    [
      'gramsPerServing',
      { label: f.gramsPerServing, max: PORTION_MAX, positive: true },
      true,
    ],
    ['calories', { label: f.calories, max: CALORIES_MAX }, false],
    ['protein', { label: f.protein, max: MACRO_MAX }, false],
    ['carbs', { label: f.carbs, max: MACRO_MAX }, false],
    ['fat', { label: f.fat, max: MACRO_MAX }, false],
    ['fiber', { label: f.fiber, max: MACRO_MAX }, true],
  ];
  const numbers: Partial<Record<keyof FoodFormValues, number>> = {};
  for (const [key, rule, optional] of fields) {
    const parsed = parseNumber(values[key], rule, optional);
    if (!parsed.ok) return { ok: false, error: numberError(rule) };
    if (parsed.value !== undefined) numbers[key] = parsed.value;
  }

  const input: CatalogFoodInput = {
    name,
    servingAmount: numbers.servingAmount ?? 0,
    servingUnit: values.servingUnit,
    caloriesPerServing: numbers.calories ?? 0,
    proteinPerServing: numbers.protein ?? 0,
    carbsPerServing: numbers.carbs ?? 0,
    fatPerServing: numbers.fat ?? 0,
  };
  if (brand) input.brand = brand;
  if (numbers.gramsPerServing !== undefined) {
    input.gramsPerServing = numbers.gramsPerServing;
  }
  if (numbers.fiber !== undefined) input.fiberPerServing = numbers.fiber;
  return { ok: true, input };
}

interface FoodFormProps {
  title: string;
  submitLabel: string;
  initial?: CatalogFoodView;
  /** Throws on failure; the form shows the error and stays open. */
  onSubmit: (input: CatalogFoodInput) => Promise<void>;
  onCancel: () => void;
}

export function FoodForm({
  title,
  submitLabel,
  initial,
  onSubmit,
  onCancel,
}: FoodFormProps) {
  const idPrefix = useId();
  const [values, setValues] = useState<FoodFormValues>(() =>
    initial ? toFormValues(initial) : EMPTY,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const f = es.catalog.form;

  function set(key: keyof FoodFormValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateFood(values);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      await onSubmit(result.input);
    } catch (err) {
      setFormError(catalogErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const titleId = `${idPrefix}-title`;
  const fieldId = (key: keyof FoodFormValues) => `${idPrefix}-${key}`;

  return (
    <section className="card" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <ErrorText>{formError}</ErrorText>
        <div className="filter-grid">
          <TextField
            id={fieldId('name')}
            label={f.name}
            value={values.name}
            required
            onChange={(value) => set('name', value)}
          />
          <TextField
            id={fieldId('brand')}
            label={f.brand}
            value={values.brand}
            onChange={(value) => set('brand', value)}
          />
          <NumberField
            id={fieldId('servingAmount')}
            label={f.servingAmount}
            value={values.servingAmount}
            required
            onChange={(value) => set('servingAmount', value)}
          />
          <div className="field">
            <label htmlFor={fieldId('servingUnit')}>{f.servingUnit}</label>
            <select
              id={fieldId('servingUnit')}
              required
              value={values.servingUnit}
              onChange={(e) => set('servingUnit', e.target.value)}
            >
              <option value="">{f.chooseUnit}</option>
              {SERVING_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {es.catalog.units[unit]}
                </option>
              ))}
            </select>
          </div>
          <NumberField
            id={fieldId('gramsPerServing')}
            label={f.gramsPerServing}
            value={values.gramsPerServing}
            onChange={(value) => set('gramsPerServing', value)}
          />
          <NumberField
            id={fieldId('calories')}
            label={f.calories}
            value={values.calories}
            required
            onChange={(value) => set('calories', value)}
          />
          <NumberField
            id={fieldId('protein')}
            label={f.protein}
            value={values.protein}
            required
            onChange={(value) => set('protein', value)}
          />
          <NumberField
            id={fieldId('carbs')}
            label={f.carbs}
            value={values.carbs}
            required
            onChange={(value) => set('carbs', value)}
          />
          <NumberField
            id={fieldId('fat')}
            label={f.fat}
            value={values.fat}
            required
            onChange={(value) => set('fat', value)}
          />
          <NumberField
            id={fieldId('fiber')}
            label={f.fiber}
            value={values.fiber}
            onChange={(value) => set('fiber', value)}
          />
        </div>
        <div className="button-row button-row--wrap">
          <button
            type="submit"
            className="button button--primary"
            disabled={busy}
          >
            {busy ? es.common.working : submitLabel}
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {f.cancel}
          </button>
        </div>
      </form>
    </section>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}

function TextField({ id, label, value, required, onChange }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        maxLength={TEXT_MAX}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NumberField({ id, label, value, required, onChange }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
