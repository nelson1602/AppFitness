import { fireEvent, render, screen } from '@testing-library/react-native';
import { TabShell } from './tab-shell.web';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href) },
}));
jest.mock('./app-header', () => ({
  AppHeader: () => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    return <RN.Text>Header</RN.Text>;
  },
}));
jest.mock('./tab-page', () => ({
  TabPage: ({ name }: { name: string }) => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    return <RN.Text testID="web-page">{name}</RN.Text>;
  },
}));
jest.mock('./app-tab-bar', () => ({
  AppTabBar: ({ onSelect }: { onSelect: (index: number) => void }) => {
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <RN.Pressable onPress={() => onSelect(1)} testID="web-select-workouts">
        <RN.Text>Tabs</RN.Text>
      </RN.Pressable>
    );
  },
}));

describe('TabShell Web (ADR-P044)', () => {
  it('renders only the URL-selected page and changes tabs without a native pager', async () => {
    await render(<TabShell activeName="nutrition" />);
    expect(screen.getByTestId('web-page')).toHaveTextContent('nutrition');
    await fireEvent.press(screen.getByTestId('web-select-workouts'));
    expect(mockReplace).toHaveBeenCalledWith('/workouts');
  });
});
