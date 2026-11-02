import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { ShellTabBar, TabShell } from './tab-shell.native';

let mockReducedMotion = false;
let mockScreenReader = false;
let mockNavigatorProps: Record<string, unknown> = {};

jest.mock('expo-router/js-top-tabs', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  function MockTopTabs(props: { children?: React.ReactNode; [key: string]: unknown }) {
    mockNavigatorProps = props;
    return <RN.View testID="top-tabs">{props.children}</RN.View>;
  }
  MockTopTabs.Screen = function MockScreen({ name }: { name: string }) {
    return <RN.Text testID={`screen-${name}`}>{name}</RN.Text>;
  };
  return { __esModule: true, default: MockTopTabs };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared/presentation', () => ({
  useReducedMotion: () => mockReducedMotion,
  useScreenReader: () => mockScreenReader,
}));
jest.mock('@/shared/localization', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));
jest.mock('@/shared/theme', () => ({
  useTheme: () => ({ colors: { stage: '#000' } }),
}));
jest.mock('./app-header', () => ({
  AppHeader: ({ routeName }: { routeName: string }) => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    return <RN.Text>Header {routeName}</RN.Text>;
  },
}));
jest.mock('./app-tab-bar', () => ({
  AppTabBar: ({
    activeIndex,
    onSelect,
  }: {
    activeIndex: number;
    onSelect: (i: number) => void;
  }) => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <RN.View testID={`tab-bar-active-${activeIndex}`}>
        <RN.Pressable onPress={() => onSelect(0)} testID="select-dashboard" />
        <RN.Pressable onPress={() => onSelect(4)} testID="select-profile" />
      </RN.View>
    );
  },
}));

const ROUTES = ['dashboard', 'workouts', 'nutrition', 'progress', 'profile'].map((name) => ({
  key: `${name}-key`,
  name,
}));

function navigationMock(defaultPrevented = false) {
  return {
    emit: jest.fn(() => ({ defaultPrevented })),
    navigate: jest.fn(),
  };
}

describe('TabShell native paging (ADR-P044)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion = false;
    mockScreenReader = false;
    mockNavigatorProps = {};
  });

  it('puts exactly the five main tabs, in order, in a bottom-bar pager', async () => {
    await render(<TabShell activeName="dashboard" />);

    expect(screen.getAllByTestId(/^screen-/).map((node) => node.props.testID)).toEqual([
      'screen-dashboard',
      'screen-workouts',
      'screen-nutrition',
      'screen-progress',
      'screen-profile',
    ]);
    expect(mockNavigatorProps.tabBarPosition).toBe('bottom');
    expect(mockNavigatorProps.screenOptions).toMatchObject({ lazy: true });
    expect(screen.getByText('Header dashboard')).toBeTruthy();
  });

  it('swipes and animates when motion is allowed', async () => {
    await render(<TabShell activeName="dashboard" />);

    expect(mockNavigatorProps.screenOptions).toMatchObject({
      animationEnabled: true,
      swipeEnabled: true,
    });
  });

  it.each([
    ['a screen reader', false, true],
    ['reduced motion', true, false],
  ] as const)('disables swipe and animated paging for %s', async (_label, reduced, reader) => {
    mockReducedMotion = reduced;
    mockScreenReader = reader;
    await render(<TabShell activeName="dashboard" />);

    expect(mockNavigatorProps.screenOptions).toMatchObject({
      animationEnabled: false,
      swipeEnabled: false,
    });
  });
});

describe('ShellTabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(jest.fn());
  });

  it('navigates to the pressed tab after emitting tabPress', async () => {
    const navigation = navigationMock();
    await render(<ShellTabBar navigation={navigation} state={{ index: 0, routes: ROUTES }} />);

    await fireEvent.press(screen.getByTestId('select-profile'));

    expect(navigation.emit).toHaveBeenCalledWith({
      canPreventDefault: true,
      target: 'profile-key',
      type: 'tabPress',
    });
    expect(navigation.navigate).toHaveBeenCalledWith('profile', undefined);
  });

  it('does not navigate when the active tab is pressed again or the press is prevented', async () => {
    const navigation = navigationMock();
    await render(<ShellTabBar navigation={navigation} state={{ index: 0, routes: ROUTES }} />);
    await fireEvent.press(screen.getByTestId('select-dashboard'));
    expect(navigation.navigate).not.toHaveBeenCalled();

    const prevented = navigationMock(true);
    await render(<ShellTabBar navigation={prevented} state={{ index: 0, routes: ROUTES }} />);
    await fireEvent.press(screen.getByTestId('select-profile'));
    expect(prevented.navigate).not.toHaveBeenCalled();
  });

  it('announces the new active tab however it changed, but not on first render', async () => {
    const navigation = navigationMock();
    const view = await render(
      <ShellTabBar navigation={navigation} state={{ index: 0, routes: ROUTES }} />,
    );
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();

    await view.rerender(
      <ShellTabBar navigation={navigation} state={{ index: 2, routes: ROUTES }} />,
    );

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('tabs.nutrition');
    expect(screen.getByTestId('tab-bar-active-2')).toBeTruthy();
  });
});
