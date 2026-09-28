/**
 * Structural guard for **UX-5** — the migration of the seven REDUCED-family
 * inputs (`.ai/08_UI_UX.md` §Input style-family reconciliation) onto
 * `AppTextInput`: two in `DietaryPreferences.tsx` (Nutrition slice) and five in
 * `RoutineBuilder.tsx` / `WorkoutLogScreen.tsx` (Workout slice).
 *
 * It is deliberately bounded to those three files. It says nothing about
 * `FormField`, which keeps its raw `TextInput` for V1 (ADR-P025), about the
 * dormant medical domain, or about any other input.
 *
 * The precedent is `touch-target.source.spec.ts`.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `touch-target.source.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
};

const SRC = `${__dirname}/../..`;

/** Each UX-5 file and the number of inputs it now renders through AppTextInput. */
const UX5_FILES: Record<string, number> = {
  'features/nutrition/presentation/DietaryPreferences.tsx': 2,
  'features/workout/presentation/RoutineBuilder.tsx': 1,
  'features/workout/presentation/WorkoutLogScreen.tsx': 4,
};

/** A raw React Native text input element. `<AppTextInput` does not match. */
const RAW_INPUT = /<TextInput\b/g;
/** `TextInput` among the named imports from `react-native`. */
const RAW_IMPORT = /import\s*\{[^}]*\bTextInput\b[^}]*\}\s*from\s*'react-native'/;
const APP_INPUT = /<AppTextInput\b/g;

const read = (path: string) => require('node:fs').readFileSync(`${SRC}/${path}`, 'utf8');
const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

it('detects a raw TextInput and its import (the guard is not vacuous)', () => {
  const sample = [
    "import { Pressable, TextInput, View } from 'react-native';",
    '<TextInput value={v} />',
    '<AppTextInput value={v} />',
  ].join('\n');

  expect(count(sample, RAW_INPUT)).toBe(1);
  expect(RAW_IMPORT.test(sample)).toBe(true);
  expect(count(sample, APP_INPUT)).toBe(1);
  expect(RAW_IMPORT.test("import { Pressable, View } from 'react-native';")).toBe(false);
});

describe.each(Object.entries(UX5_FILES))('%s', (path, expected) => {
  it('renders no raw TextInput and does not import one', () => {
    const text = read(path);
    expect(count(text, RAW_INPUT)).toBe(0);
    expect(RAW_IMPORT.test(text)).toBe(false);
  });

  it(`renders exactly ${expected} AppTextInput`, () => {
    expect(count(read(path), APP_INPUT)).toBe(expected);
  });
});

it('accounts for all seven UX-5 inputs', () => {
  const total = Object.keys(UX5_FILES).reduce((sum, path) => sum + count(read(path), APP_INPUT), 0);
  expect(total).toBe(7);
});
