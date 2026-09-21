import { render, screen } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { darkColors, lightColors } from '../theme';
import { AppText } from './app-text';
import { Card } from './card';

describe('Card', () => {
  // The theme cases below spy on useColorScheme. Restore after each test so a
  // mocked scheme cannot leak into a later case and make it assert the theme it
  // was not written for.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders its children', async () => {
    await render(
      <Card>
        <AppText>Card content</AppText>
      </Card>,
    );

    expect(screen.getByText('Card content')).toBeOnTheScreen();
  });

  it('exposes the accessibility label passed by callers', async () => {
    await render(
      <Card accessibilityLabel="Today assessment summary">
        <AppText>Body</AppText>
      </Card>,
    );

    expect(screen.getByLabelText('Today assessment summary')).toBeOnTheScreen();
  });

  it('keeps the light card on the surface with level-one elevation', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');

    await render(
      <Card testID="light-card">
        <AppText>Body</AppText>
      </Card>,
    );

    expect(screen.getByTestId('light-card')).toHaveStyle({
      backgroundColor: lightColors.surface,
      elevation: 1,
      shadowOpacity: 0.08,
    });
  });

  it('uses a quiet tinted surface without an invisible shadow in dark mode', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    await render(
      <Card testID="dark-card">
        <AppText>Body</AppText>
      </Card>,
    );

    expect(screen.getByTestId('dark-card')).toHaveStyle({
      backgroundColor: darkColors.surfaceVariant,
      elevation: 0,
      shadowOpacity: 0,
    });
  });

  it('keeps caller style precedence', async () => {
    await render(
      <Card style={{ backgroundColor: lightColors.primaryContainer }} testID="custom-card">
        <AppText>Body</AppText>
      </Card>,
    );

    expect(screen.getByTestId('custom-card')).toHaveStyle({
      backgroundColor: lightColors.primaryContainer,
    });
  });
});
