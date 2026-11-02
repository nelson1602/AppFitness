import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppTabBar } from './app-tab-bar';

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

const select = jest.fn();

function props(index: number) {
  return { activeIndex: index, onSelect: select };
}

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));

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

  it('selects an inactive tab', async () => {
    await render(<AppTabBar {...props(0)} />);
    await fireEvent.press(screen.getByTestId('tab-profile'));

    expect(select).toHaveBeenCalledWith(4);
  });

  it('delegates a press on the tab already shown so the shell owns the no-op', async () => {
    await render(<AppTabBar {...props(0)} />);
    await fireEvent.press(screen.getByTestId('tab-dashboard'));
    expect(select).toHaveBeenCalledWith(0);
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
