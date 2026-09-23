import { render, screen } from '@testing-library/react-native';

import { AppText } from './app-text';
import { Screen } from './screen';

/**
 * `ScrollView` reaches the host tree as `RCTScrollView`; asserting the host
 * node is what lets these tests read the props React Native actually applied.
 */
function scrollViews() {
  const root = screen.root;
  if (root === null) throw new Error('Screen rendered no root');
  return root.queryAll((node) => node.type === 'RCTScrollView');
}

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

  /**
   * BUG-021. React Native's default is `"never"`, under which the first tap on
   * a control is spent dismissing an open keyboard instead of activating it —
   * so Save had to be tapped twice after typing on every scrollable form.
   *
   * This asserts the **prop**, which is all a component test can observe:
   * `jest-expo` has no keyboard, so the tap-consumption behaviour itself is
   * device-only and is not claimed here.
   */
  it('lets a tap reach a control while the keyboard is open', async () => {
    await render(
      <Screen>
        <AppText>Scrollable content</AppText>
      </Screen>,
    );

    const [scrollView] = scrollViews();
    expect(scrollView?.props.keyboardShouldPersistTaps).toBe('handled');
  });

  // The fixed branch must stay a plain View: adding a ScrollView here would
  // change layout and reintroduce scrolling on screens that deliberately have
  // none.
  it('creates no ScrollView when scroll is disabled', async () => {
    await render(
      <Screen scroll={false}>
        <AppText>Fixed content</AppText>
      </Screen>,
    );

    expect(scrollViews()).toHaveLength(0);
  });
});
