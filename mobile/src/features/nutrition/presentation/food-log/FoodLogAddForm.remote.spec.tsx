import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { saveChosenFood, saveCustomFood } from '../../application/remote-food.service';
import type { CanonicalFood } from '../../domain/catalog-identity';
import {
  FoodSearchOfflineError,
  FoodSearchRequestError,
  type FoodSearchResult,
  searchRemoteFoods,
} from '../../infrastructure/food-search-api';
import { searchSavedFoods } from '../../infrastructure/saved-foods.repository';
import { FoodLogAddForm } from './FoodLogAddForm';

/**
 * v10 Block B, item 7: beyond the phone's catalogue the form searches the
 * server (shared catalogue, USDA FoodData Central, Open Food Facts), saves a
 * chosen result before logging it, says when it is offline, and lets the
 * person create a food that exists nowhere.
 */
let mockLanguage: 'en' | 'es' = 'es';

jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual('@/shared/localization/resources/en') as {
    en: Record<string, string>;
  };
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  return {
    ...jest.requireActual('@/shared/localization'),
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => (mockLanguage === 'es' ? es[key] : en[key]) ?? key,
    }),
  };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));
jest.mock('../../infrastructure/food-search-api', () => ({
  ...jest.requireActual('../../infrastructure/food-search-api'),
  searchRemoteFoods: jest.fn(),
}));
jest.mock('../../infrastructure/saved-foods.repository', () => ({
  searchSavedFoods: jest.fn().mockResolvedValue([]),
  saveFoodLocally: jest.fn(),
}));
jest.mock('../../application/remote-food.service', () => ({
  ...jest.requireActual('../../application/remote-food.service'),
  saveChosenFood: jest.fn(),
  saveCustomFood: jest.fn(),
}));

const CHICHARRON: FoodSearchResult = {
  source: 'off',
  sourceId: '7501000000123',
  foodId: null,
  name: 'Chicharrón de cerdo',
  brand: 'Doña Rosa',
  servingAmount: 100,
  servingUnit: 'g',
  gramsPerServing: 100,
  caloriesPerServing: 544,
  proteinPerServing: 61.3,
  carbsPerServing: 0,
  fatPerServing: 31.3,
  fiberPerServing: null,
};

const saved = (over: Partial<CanonicalFood> = {}): CanonicalFood => ({
  id: '11111111-1111-5111-8111-111111111111',
  catalogKey: 'off.7501000000123',
  foodRevision: 1,
  catalogVersion: 'external@1',
  name: 'Chicharrón de cerdo',
  category: 'external',
  servingAmount: 100,
  servingUnit: 'g',
  gramsPerServing: 100,
  caloriesPerServing: 544,
  proteinPerServing: 61.3,
  carbsPerServing: 0,
  fatPerServing: 31.3,
  fiberPerServing: null,
  ...over,
});

async function search(text: string) {
  await fireEvent.changeText(screen.getByTestId('food-search-input'), text);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockLanguage = 'es';
  jest.mocked(searchRemoteFoods).mockReset();
  jest.mocked(saveChosenFood).mockReset();
  jest.mocked(saveCustomFood).mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('FoodLogAddForm beyond the local catalogue (v10 Block B, item 7)', () => {
  it('finds "Chicharrón de cerdo" on the server, saves it and logs it under its catalogue key', async () => {
    jest.mocked(searchRemoteFoods).mockResolvedValue({ results: [CHICHARRON], external: 'ok' });
    jest.mocked(saveChosenFood).mockResolvedValue(saved());
    const onAdd = jest.fn();
    await render(<FoodLogAddForm defaultMealType="LUNCH" onAdd={onAdd} />);

    await search('Chicharrón de cerdo');
    expect(searchRemoteFoods).toHaveBeenCalledWith('Chicharrón de cerdo');
    expect(screen.getByText('Más alimentos')).toBeOnTheScreen();
    expect(screen.getByText('Open Food Facts')).toBeOnTheScreen();
    expect(screen.getByTestId('food-remote-attribution')).toHaveTextContent(
      'Datos de USDA FoodData Central y de Open Food Facts (ODbL).',
    );

    await fireEvent.press(screen.getByTestId('food-remote-off-7501000000123'));
    await fireEvent.press(screen.getByTestId('food-log-add-submit'));

    expect(saveChosenFood).toHaveBeenCalledWith(CHICHARRON);
    expect(onAdd).toHaveBeenCalledWith('off.7501000000123', 'LUNCH', 1);
  });

  it('keeps the choice and asks to check the connection only when the phone is offline', async () => {
    jest.mocked(searchRemoteFoods).mockResolvedValue({ results: [CHICHARRON], external: 'ok' });
    jest.mocked(saveChosenFood).mockRejectedValue(new FoodSearchOfflineError());
    const onAdd = jest.fn();
    await render(<FoodLogAddForm onAdd={onAdd} />);

    await search('chicharron');
    await fireEvent.press(screen.getByTestId('food-remote-off-7501000000123'));
    await fireEvent.press(screen.getByTestId('food-log-add-submit'));

    expect(onAdd).not.toHaveBeenCalled();
    expect(
      screen.getByText('No pudimos guardar este alimento. Revisa tu conexión e intenta de nuevo.'),
    ).toBeOnTheScreen();
  });

  // v10: a 402 SUBSCRIPTION_REQUIRED is never shown as a connection problem.
  it('says a subscription is needed on a 402, with a button to Suscripción', async () => {
    jest.mocked(searchRemoteFoods).mockResolvedValue({ results: [CHICHARRON], external: 'ok' });
    jest.mocked(saveChosenFood).mockRejectedValue(new FoodSearchRequestError(402));
    const onAdd = jest.fn();
    await render(<FoodLogAddForm onAdd={onAdd} />);

    await search('chicharron');
    await fireEvent.press(screen.getByTestId('food-remote-off-7501000000123'));
    await fireEvent.press(screen.getByTestId('food-log-add-submit'));

    expect(onAdd).not.toHaveBeenCalled();
    expect(
      screen.getByText('Necesitas una suscripción activa para guardar esto'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Revisa tu conexión/)).toBeNull();
    await fireEvent.press(screen.getByTestId('food-save-subscription-open'));
    expect(mockPush).toHaveBeenCalledWith('/subscription');
  });

  it('says the server could not save it on any other error, never "check your connection"', async () => {
    jest.mocked(searchRemoteFoods).mockResolvedValue({ results: [CHICHARRON], external: 'ok' });
    jest.mocked(saveChosenFood).mockRejectedValue(new FoodSearchRequestError(500));
    await render(<FoodLogAddForm onAdd={jest.fn()} />);

    await search('chicharron');
    await fireEvent.press(screen.getByTestId('food-remote-off-7501000000123'));
    await fireEvent.press(screen.getByTestId('food-log-add-submit'));

    expect(
      screen.getByText('No pudimos guardar este alimento. Inténtalo de nuevo en un momento.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Revisa tu conexión/)).toBeNull();
  });

  it('says a subscription is needed when creating a food answers 402', async () => {
    jest.mocked(searchRemoteFoods).mockResolvedValue({ results: [], external: 'ok' });
    jest.mocked(saveCustomFood).mockRejectedValue(new FoodSearchRequestError(402));
    await render(<FoodLogAddForm onAdd={jest.fn()} />);

    await search('Chicharrón de la abuela');
    await fireEvent.press(screen.getByTestId('custom-food-open'));
    await fireEvent.changeText(screen.getByTestId('custom-food-kcal'), '520');
    await fireEvent.changeText(screen.getByTestId('custom-food-protein'), '58');
    await fireEvent.changeText(screen.getByTestId('custom-food-carbs'), '0');
    await fireEvent.changeText(screen.getByTestId('custom-food-fat'), '32');
    await fireEvent.press(screen.getByTestId('custom-food-save'));

    expect(screen.getByTestId('custom-food-subscription')).toBeOnTheScreen();
    expect(screen.queryByText(/Revisa tu conexión/)).toBeNull();
  });

  it('shows a saved food with the same rounded kcal as the log: 541, never 540,7 (v10 Block C)', async () => {
    jest.mocked(searchRemoteFoods).mockRejectedValue(new FoodSearchOfflineError());
    jest.mocked(searchSavedFoods).mockResolvedValueOnce([saved({ caloriesPerServing: 540.7 })]);
    await render(<FoodLogAddForm onAdd={jest.fn()} />);

    await search('chicharron');
    expect(await screen.findByText(/100 g · 541 kcal/)).toBeOnTheScreen();
    expect(screen.queryByText(/540,7/)).toBeNull();
  });

  it('shows only local results with a clear message when offline', async () => {
    jest.mocked(searchRemoteFoods).mockRejectedValue(new FoodSearchOfflineError());
    await render(<FoodLogAddForm onAdd={jest.fn()} />);

    await search('pollo');
    expect(screen.getByTestId('food-remote-status-offline')).toHaveTextContent(
      'Sin conexión: solo se muestran los alimentos guardados en tu teléfono.',
    );
    // The bundled catalogue still answers.
    expect(screen.getAllByRole('button', { name: /^Elegir/ }).length).toBeGreaterThan(0);
  });

  it('lets the person create a food that exists nowhere, then log it', async () => {
    jest.mocked(searchRemoteFoods).mockResolvedValue({ results: [], external: 'ok' });
    jest.mocked(saveCustomFood).mockResolvedValue(
      saved({
        id: '22222222-2222-5222-8222-222222222222',
        catalogKey: 'custom.4d1c',
        catalogVersion: 'custom@1',
        category: 'custom',
        name: 'Chicharrón de la abuela',
        caloriesPerServing: 520,
      }),
    );
    const onAdd = jest.fn();
    await render(<FoodLogAddForm defaultMealType="DINNER" onAdd={onAdd} />);

    await search('Chicharrón de la abuela');
    expect(screen.getByTestId('food-search-no-results')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('custom-food-open'));
    expect(screen.getByTestId('custom-food-name').props.value).toBe('Chicharrón de la abuela');
    await fireEvent.changeText(screen.getByTestId('custom-food-kcal'), '520');
    await fireEvent.changeText(screen.getByTestId('custom-food-protein'), '58,5');
    await fireEvent.changeText(screen.getByTestId('custom-food-carbs'), '0');
    await fireEvent.changeText(screen.getByTestId('custom-food-fat'), '32');
    await fireEvent.press(screen.getByTestId('custom-food-save'));

    expect(saveCustomFood).toHaveBeenCalledWith({
      name: 'Chicharrón de la abuela',
      servingAmount: 100,
      servingUnit: 'g',
      gramsPerServing: 100,
      caloriesPerServing: 520,
      proteinPerServing: 58.5,
      carbsPerServing: 0,
      fatPerServing: 32,
    });
    await fireEvent.press(screen.getByTestId('food-log-add-submit'));
    expect(onAdd).toHaveBeenCalledWith('custom.4d1c', 'DINNER', 1);
  });

  it('rejects a custom food with missing values without calling the server', async () => {
    jest.mocked(searchRemoteFoods).mockResolvedValue({ results: [], external: 'ok' });
    await render(<FoodLogAddForm onAdd={jest.fn()} />);

    await search('algo raro');
    await fireEvent.press(screen.getByTestId('custom-food-open'));
    await fireEvent.press(screen.getByTestId('custom-food-save'));

    expect(saveCustomFood).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Revisa los datos: el nombre, una porción mayor que 0 y calorías y macros de 0 o más.',
      ),
    ).toBeOnTheScreen();
  });
});
