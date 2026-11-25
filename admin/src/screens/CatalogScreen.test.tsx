import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CatalogFoodView } from '../api/types';
import { es } from '../i18n/es';
import { makeFood } from '../test/fixtures';
import {
  bodyOfCall,
  countCalls,
  headersOf,
  mockFetch,
  urlOf,
} from '../test/fetchMock';
import { CatalogScreen } from './CatalogScreen';

const LIST = 'GET catalog/foods?page=1&pageSize=25';
const page = (items: CatalogFoodView[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 25,
});
const detail = (food: CatalogFoodView, revisions = [food]) => ({
  body: { food, revisions },
});

const f = es.catalog.form;
const d = es.catalog.detail;

describe('CatalogScreen food list', () => {
  it('renders foods and sends the applied filters', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      [LIST]: { body: page([makeFood()]) },
      'GET catalog/foods?q=arepa&kind=staff&status=retired&page=1&pageSize=25':
        { body: page([]) },
    });

    render(<CatalogScreen />);

    const link = await screen.findByRole('link', { name: 'Arepa de maíz' });
    expect(link).toHaveAttribute('href', '#/catalogo/food-1');
    const row = link.closest('tr');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent(es.catalog.kinds.staff);
    expect(row).toHaveTextContent(es.catalog.statuses.active);
    expect(row).toHaveTextContent('1 pieza (90 g)');

    await user.type(
      screen.getByLabelText(es.catalog.foods.searchLabel),
      'arepa',
    );
    await user.selectOptions(
      screen.getByLabelText(es.catalog.foods.kindLabel),
      'staff',
    );
    await user.selectOptions(
      screen.getByLabelText(es.catalog.foods.statusLabel),
      'retired',
    );
    await user.click(
      screen.getByRole('button', { name: es.catalog.foods.search }),
    );

    expect(await screen.findByText(es.catalog.foods.empty)).toBeInTheDocument();
    expect(urlOf(fetchMock.mock.calls.at(-1)?.[0] ?? '')).toBe(
      '/admin/api/catalog/foods?q=arepa&kind=staff&status=retired&page=1&pageSize=25',
    );
  });

  it('creates a food with parsed numbers and omits empty optional fields', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      [LIST]: { body: page([]) },
      'POST catalog/foods': {
        status: 201,
        body: makeFood({ id: 'food-9', name: 'Yuca' }),
      },
    });

    render(<CatalogScreen />);
    await screen.findByText(es.catalog.foods.resultCount(0));
    await user.click(
      screen.getByRole('button', { name: es.catalog.foods.add }),
    );

    await user.type(screen.getByLabelText(f.name), '  Yuca hervida ');
    await user.type(screen.getByLabelText(f.servingAmount), '100');
    await user.selectOptions(screen.getByLabelText(f.servingUnit), 'g');
    await user.type(screen.getByLabelText(f.calories), '159.5');
    await user.type(screen.getByLabelText(f.protein), '1.4');
    await user.type(screen.getByLabelText(f.carbs), '38');
    await user.type(screen.getByLabelText(f.fat), '0.3');
    await user.click(screen.getByRole('button', { name: f.create }));

    expect(
      await screen.findByText(es.catalog.foods.created),
    ).toBeInTheDocument();
    expect(bodyOfCall(fetchMock.mock.calls, 'catalog/foods')).toEqual({
      name: 'Yuca hervida',
      servingAmount: 100,
      servingUnit: 'g',
      caloriesPerServing: 159.5,
      proteinPerServing: 1.4,
      carbsPerServing: 38,
      fatPerServing: 0.3,
    });
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(headersOf(post?.[1])['X-Admin-CSRF']).toBe('1');
    // The form closes and the list reloads.
    expect(screen.queryByLabelText(f.name)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(countCalls(fetchMock.mock.calls, 'page=1&pageSize=25')).toBe(2),
    );
  });

  it('blocks an out-of-range value before calling the server', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ [LIST]: { body: page([]) } });

    render(<CatalogScreen />);
    await screen.findByText(es.catalog.foods.resultCount(0));
    await user.click(
      screen.getByRole('button', { name: es.catalog.foods.add }),
    );
    await user.type(screen.getByLabelText(f.name), 'Agua');
    await user.type(screen.getByLabelText(f.servingAmount), '0');
    await user.selectOptions(screen.getByLabelText(f.servingUnit), 'ml');
    await user.click(screen.getByRole('button', { name: f.create }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      f.positive(f.servingAmount, 5000),
    );
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false);
  });

  it('shows the server message when the food is rejected (400)', async () => {
    const user = userEvent.setup();
    const message = 'Las calorías superan 9 kcal por gramo.';
    mockFetch({
      [LIST]: { body: page([]) },
      'POST catalog/foods': {
        status: 400,
        body: { statusCode: 400, message },
      },
    });

    render(<CatalogScreen />);
    await screen.findByText(es.catalog.foods.resultCount(0));
    await user.click(
      screen.getByRole('button', { name: es.catalog.foods.add }),
    );
    await user.type(screen.getByLabelText(f.name), 'Aceite');
    await user.type(screen.getByLabelText(f.servingAmount), '10');
    await user.selectOptions(screen.getByLabelText(f.servingUnit), 'g');
    await user.type(screen.getByLabelText(f.calories), '900');
    await user.type(screen.getByLabelText(f.protein), '0');
    await user.type(screen.getByLabelText(f.carbs), '0');
    await user.type(screen.getByLabelText(f.fat), '10');
    await user.click(screen.getByRole('button', { name: f.create }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      es.catalog.invalidData(message),
    );
    expect(screen.getByLabelText(f.name)).toHaveValue('Aceite');
  });
});

describe('CatalogScreen food detail', () => {
  it('corrects with the current values prefilled and opens the new revision', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      'GET catalog/foods/food-1': detail(makeFood()),
      'POST catalog/foods/food-1/revisions': {
        status: 201,
        body: makeFood({ id: 'food-2', foodRevision: 2 }),
      },
    });

    render(<CatalogScreen foodId="food-1" />);
    await screen.findByRole('heading', { name: 'Arepa de maíz', level: 1 });
    expect(screen.getByText(es.catalog.correctExplain)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: d.correct }));

    expect(screen.getByLabelText(f.name)).toHaveValue('Arepa de maíz');
    expect(screen.getByLabelText(f.brand)).toHaveValue('Casera');
    expect(screen.getByLabelText(f.servingUnit)).toHaveValue('piece');
    expect(screen.getByLabelText(f.gramsPerServing)).toHaveValue(90);
    expect(screen.getByLabelText(f.fiber)).toHaveValue(null);

    const calories = screen.getByLabelText(f.calories);
    await user.clear(calories);
    await user.type(calories, '210');
    await user.click(screen.getByRole('button', { name: f.saveCorrection }));

    await screen.findByRole('button', { name: d.correct });
    expect(
      bodyOfCall(fetchMock.mock.calls, 'catalog/foods/food-1/revisions'),
    ).toEqual({
      name: 'Arepa de maíz',
      brand: 'Casera',
      servingAmount: 1,
      servingUnit: 'piece',
      gramsPerServing: 90,
      caloriesPerServing: 210,
      proteinPerServing: 4,
      carbsPerServing: 40,
      fatPerServing: 2.5,
    });
    expect(window.location.hash).toBe('#/catalogo/food-2');
  });

  it('asks to reload when the food changed meanwhile (409)', async () => {
    const user = userEvent.setup();
    mockFetch({
      'GET catalog/foods/food-1': detail(makeFood()),
      'POST catalog/foods/food-1/revisions': {
        status: 409,
        body: { statusCode: 409, message: 'Conflict' },
      },
    });

    render(<CatalogScreen foodId="food-1" />);
    await user.click(await screen.findByRole('button', { name: d.correct }));
    await user.click(screen.getByRole('button', { name: f.saveCorrection }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      es.catalog.conflict,
    );
    expect(window.location.hash).not.toBe('#/catalogo/food-2');
  });

  it('retires only after confirmation', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      'GET catalog/foods/food-1': detail(makeFood()),
      'POST catalog/foods/food-1/retire': {
        body: makeFood({ status: 'retired' }),
      },
    });

    render(<CatalogScreen foodId="food-1" />);
    await user.click(await screen.findByRole('button', { name: d.retire }));

    const dialog = screen.getByRole('dialog', { name: d.retireTitle });
    expect(dialog).toHaveTextContent(es.catalog.retireExplain);
    expect(countCalls(fetchMock.mock.calls, 'food-1/retire')).toBe(0);
    await user.click(
      within(dialog).getByRole('button', { name: d.retireConfirm }),
    );

    expect(await screen.findByText(d.retired)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([input]) =>
      urlOf(input).endsWith('food-1/retire'),
    );
    expect(call?.[1]?.method).toBe('POST');
    expect(headersOf(call?.[1])['X-Admin-CSRF']).toBe('1');
  });

  it('cancelling the retire dialog sends nothing', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      'GET catalog/foods/food-1': detail(makeFood()),
    });

    render(<CatalogScreen foodId="food-1" />);
    await user.click(await screen.findByRole('button', { name: d.retire }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: es.userDetail.cancel,
      }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(countCalls(fetchMock.mock.calls, 'food-1/retire')).toBe(0);
  });

  it('restores a retired food', async () => {
    const user = userEvent.setup();
    const retired = makeFood({
      status: 'retired',
      retiredAt: '2026-11-22T10:00:00.000Z',
    });
    const fetchMock = mockFetch({
      'GET catalog/foods/food-1': detail(retired),
      'POST catalog/foods/food-1/restore': { body: makeFood() },
    });

    render(<CatalogScreen foodId="food-1" />);
    expect(
      await screen.findByRole('button', { name: d.restore }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: d.retire }),
    ).not.toBeInTheDocument();
    // The server corrects only active foods: restore first.
    expect(
      screen.queryByRole('button', { name: d.correct }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(es.catalog.restoreBeforeCorrect),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: d.restore }));

    expect(await screen.findByText(d.restored)).toBeInTheDocument();
    expect(countCalls(fetchMock.mock.calls, 'food-1/restore')).toBe(1);
  });

  it('keeps bundled foods read-only and shows the revision history', async () => {
    const bundled = makeFood({
      id: 'food-b2',
      kind: 'bundled',
      editable: false,
      foodRevision: 2,
      catalogVersion: '2026.11',
      caloriesPerServing: 150,
    });
    const older = makeFood({
      id: 'food-b1',
      kind: 'bundled',
      editable: false,
      status: 'superseded',
      caloriesPerServing: 140,
      createdAt: '2026-10-01T10:00:00.000Z',
    });
    mockFetch({
      'GET catalog/foods/food-b2': detail(bundled, [bundled, older]),
    });

    render(<CatalogScreen foodId="food-b2" />);

    expect(
      await screen.findByText(es.catalog.bundledReadOnly),
    ).toBeInTheDocument();
    for (const name of [d.correct, d.retire, d.restore]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    const history = screen.getByRole('table', { name: d.revisionsCaption });
    const rows = within(history).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('2');
    expect(rows[0]).toHaveTextContent(es.catalog.statuses.active);
    expect(rows[0]).toHaveTextContent('150');
    expect(rows[1]).toHaveTextContent(es.catalog.statuses.superseded);
    expect(rows[1]).toHaveTextContent('140');
  });
});

describe('CatalogScreen exercises', () => {
  it('lists exercises read-only with search', async () => {
    const user = userEvent.setup();
    const exercise = {
      id: 'ex-1',
      name: 'Sentadilla',
      muscleGroup: 'Piernas',
      category: 'Fuerza',
      instructions: null,
    };
    const fetchMock = mockFetch({
      [LIST]: { body: page([]) },
      'GET catalog/exercises?page=1&pageSize=25': {
        body: { items: [exercise], total: 1, page: 1, pageSize: 25 },
      },
      'GET catalog/exercises?q=sent&page=1&pageSize=25': {
        body: { items: [exercise], total: 1, page: 1, pageSize: 25 },
      },
    });

    render(<CatalogScreen />);
    await screen.findByText(es.catalog.foods.resultCount(0));
    await user.click(
      screen.getByRole('tab', { name: es.catalog.exercisesTab }),
    );

    expect(
      screen.getByRole('tab', { name: es.catalog.exercisesTab }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(es.catalog.exercisesReadOnly)).toBeInTheDocument();
    const row = (await screen.findByText('Sentadilla')).closest('tr');
    expect(row).toHaveTextContent('Piernas');
    expect(row).toHaveTextContent('Fuerza');
    expect(
      screen.queryByRole('button', { name: es.catalog.foods.add }),
    ).not.toBeInTheDocument();
    expect(within(row ?? document.body).queryByRole('button')).toBeNull();

    await user.type(
      screen.getByLabelText(es.catalog.exercises.searchLabel),
      'sent',
    );
    await user.click(
      screen.getByRole('button', { name: es.catalog.exercises.search }),
    );
    await screen.findByText('Sentadilla');
    expect(urlOf(fetchMock.mock.calls.at(-1)?.[0] ?? '')).toBe(
      '/admin/api/catalog/exercises?q=sent&page=1&pageSize=25',
    );
  });

  it('switches tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    mockFetch({
      [LIST]: { body: page([]) },
      'GET catalog/exercises?page=1&pageSize=25': {
        body: { items: [], total: 0, page: 1, pageSize: 25 },
      },
    });

    render(<CatalogScreen />);
    const foodsTab = screen.getByRole('tab', { name: es.catalog.foodsTab });
    foodsTab.focus();
    await user.keyboard('{ArrowRight}');

    const exercisesTab = screen.getByRole('tab', {
      name: es.catalog.exercisesTab,
    });
    expect(exercisesTab).toHaveFocus();
    expect(exercisesTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(
      es.catalog.exercisesTab,
    );
  });
});
