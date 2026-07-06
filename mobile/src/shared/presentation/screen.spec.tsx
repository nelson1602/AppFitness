import { render, screen } from '@testing-library/react-native';

import { AppText } from './app-text';
import { Screen } from './screen';

describe('Screen', () => {
  it('renders children inside a scrollable container by default', async () => {
    await render(
      <Screen>
        <AppText>Scrollable content</AppText>
      </Screen>,
    );

    expect(screen.getByText('Scrollable content')).toBeOnTheScreen();
  });

  it('renders a plain flex view when scroll is disabled (forms)', async () => {
    await render(
      <Screen scroll={false}>
        <AppText>Fixed content</AppText>
      </Screen>,
    );

    expect(screen.getByText('Fixed content')).toBeOnTheScreen();
  });
});
