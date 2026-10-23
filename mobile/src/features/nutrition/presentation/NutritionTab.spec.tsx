import { fireEvent, render, screen } from '@testing-library/react-native';

import { NutritionTab } from './NutritionTab';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('./NutritionTargets', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return { NutritionTargets: () => <RN.Text testID="nutrition-targets">targets</RN.Text> };
});

function push() {
  return jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router.push;
}

beforeEach(() => jest.clearAllMocks());

/** The two nutrition spokes that sat on the dashboard before ADR-P039. */
describe('NutritionTab', () => {
  it("shows today's targets first", async () => {
    await render(<NutritionTab />);
    expect(screen.getByTestId('nutrition-targets')).toBeOnTheScreen();
  });

  it.each([
    ["Open today's food log", '/food-log'],
    ['Manage dietary preferences and allergies', '/dietary-preferences'],
  ] as const)('"%s" opens %s', async (name, href) => {
    await render(<NutritionTab />);
    await fireEvent.press(screen.getByRole('button', { name }));
    expect(push()).toHaveBeenCalledWith(href);
  });
});
