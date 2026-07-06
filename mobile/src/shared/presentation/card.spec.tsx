import { render, screen } from '@testing-library/react-native';

import { AppText } from './app-text';
import { Card } from './card';

describe('Card', () => {
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
});
