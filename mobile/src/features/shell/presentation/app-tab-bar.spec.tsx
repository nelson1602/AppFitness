import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { AppTabBar } from './app-tab-bar';
import { TABS } from './tab-config';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

const emit = jest.fn(() => ({ defaultPrevented: false }));
const navigate = jest.fn();

function props(index: number): BottomTabBarProps {
  return {
    state: {
      index,
      routes: TABS.map((tab) => ({ key: `${tab.name}-key`, name: tab.name })),
    },
    navigation: { emit, navigate },
    insets: { top: 0, bottom: 24, left: 0, right: 0 },
    descriptors: {},
  } as unknown as BottomTabBarProps;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
});

describe('AppTabBar (ADR-P039 D1)', () => {
  it('is a tab list of the five design tabs, in order, each named', async () => {
    await render(<AppTabBar {...props(0)} />);

    expect(screen.getByTestId('tab-list').props.accessibilityRole).toBe('tablist');
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Home',
      'Workouts',
      'Nutrition',
      'Progress',
      'Profile',
    ]);
  });

  it('marks only the active tab selected and shows only its label — never colour alone', async () => {
    await render(<AppTabBar {...props(2)} />);

    const selected = screen
      .getAllByRole('tab')
      .filter((tab) => tab.props.accessibilityState?.selected);
    expect(selected.map((tab) => tab.props.testID)).toEqual(['tab-nutrition']);
    expect(screen.getByText('Nutrition')).toBeOnTheScreen();
    expect(screen.queryByText('Home')).toBeNull();
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('emits tabPress and then navigates to an inactive tab', async () => {
    await render(<AppTabBar {...props(0)} />);
    await fireEvent.press(screen.getByTestId('tab-profile'));

    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'profile-key',
      canPreventDefault: true,
    });
    expect(navigate).toHaveBeenCalledWith('profile');
  });

  it('does not navigate again to the tab already shown, or when tabPress is prevented', async () => {
    await render(<AppTabBar {...props(0)} />);
    await fireEvent.press(screen.getByTestId('tab-dashboard'));
    expect(navigate).not.toHaveBeenCalled();

    emit.mockReturnValueOnce({ defaultPrevented: true });
    await fireEvent.press(screen.getByTestId('tab-workouts'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('names the tabs in Spanish', async () => {
    mockLanguage = 'es';
    await render(<AppTabBar {...props(0)} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Inicio',
      'Entrenamientos',
      'Nutrición',
      'Progreso',
      'Perfil',
    ]);
    expect(screen.getByText('Inicio')).toBeOnTheScreen();
  });

  it('clears the bottom inset', async () => {
    await render(<AppTabBar {...props(0)} />);
    expect(screen.getByTestId('tab-bar')).toHaveStyle({ paddingBottom: 24 });
  });
});
