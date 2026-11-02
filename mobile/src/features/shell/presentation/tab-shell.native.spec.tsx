import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { TabShell } from './tab-shell.native';

const mockReplace = jest.fn();
const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
let mockReducedMotion = false;
let mockScreenReader = false;

jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href) },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(function MockPagerView(
      props: { children?: React.ReactNode; testID?: string; [key: string]: unknown },
      ref: React.ForwardedRef<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({
        setPage: mockSetPage,
        setPageWithoutAnimation: mockSetPageWithoutAnimation,
      }));
      return React.createElement(RN.View, props, props.children);
    }),
  };
});
jest.mock('@/shared/presentation', () => ({
  useReducedMotion: () => mockReducedMotion,
  useScreenReader: () => mockScreenReader,
}));
jest.mock('@/shared/localization', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));
jest.mock('./app-header', () => ({
  AppHeader: ({ routeName }: { routeName: string }) => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    return <RN.Text>Header {routeName}</RN.Text>;
  },
}));
jest.mock('./app-tab-bar', () => ({
  AppTabBar: ({ onSelect }: { onSelect: (index: number) => void }) => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <RN.Pressable onPress={() => onSelect(4)} testID="select-profile">
        <RN.Text>Tabs</RN.Text>
      </RN.Pressable>
    );
  },
}));
jest.mock('./tab-page', () => ({
  TabPage: ({ name }: { name: string }) => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    const { useTabPagerSwipeExclusion } =
      jest.requireActual<typeof import('./tab-pager-gesture')>('./tab-pager-gesture');
    const exclusion = useTabPagerSwipeExclusion();
    return (
      <RN.View testID={`inner-scroller-${name}`} {...exclusion}>
        <RN.Text testID={`page-${name}`}>{name}</RN.Text>
      </RN.View>
    );
  },
}));

describe('TabShell native paging (ADR-P044)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion = false;
    mockScreenReader = false;
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(jest.fn());
  });

  it('keeps exactly the five main tabs inside the pager', async () => {
    await render(<TabShell activeName="dashboard" />);
    expect(screen.getAllByTestId(/^page-/).map((page) => page.props.testID)).toEqual([
      'page-dashboard',
      'page-workouts',
      'page-nutrition',
      'page-progress',
      'page-profile',
    ]);
  });

  it('moves with animation after a tab press and reconciles the URL after selection', async () => {
    await render(<TabShell activeName="dashboard" />);
    await fireEvent.press(screen.getByTestId('select-profile'));
    expect(mockSetPage).toHaveBeenCalledWith(4);

    await fireEvent(screen.getByTestId('tab-pager'), 'pageSelected', {
      nativeEvent: { position: 4 },
    });
    expect(mockReplace).toHaveBeenCalledWith('/profile');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('tabs.profile');
  });

  it('keeps an inner horizontal scroller in control of its own gesture', async () => {
    await render(<TabShell activeName="dashboard" />);
    const pager = screen.getByTestId('tab-pager');
    const scroller = screen.getByTestId('inner-scroller-dashboard');

    expect(pager.props.scrollEnabled).toBe(true);
    await fireEvent(scroller, 'touchStart', { nativeEvent: {} });
    expect(screen.getByTestId('tab-pager').props.scrollEnabled).toBe(false);
    await fireEvent(scroller, 'touchEnd', { nativeEvent: {} });
    expect(screen.getByTestId('tab-pager').props.scrollEnabled).toBe(true);
  });

  it.each([
    ['a screen reader', false, true],
    ['reduced motion', true, false],
  ] as const)('disables swipe and animated tab changes for %s', async (_label, reduced, reader) => {
    mockReducedMotion = reduced;
    mockScreenReader = reader;
    await render(<TabShell activeName="dashboard" />);

    expect(screen.getByTestId('tab-pager').props.scrollEnabled).toBe(false);
    await fireEvent.press(screen.getByTestId('select-profile'));
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(4);
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/profile');
  });
});
