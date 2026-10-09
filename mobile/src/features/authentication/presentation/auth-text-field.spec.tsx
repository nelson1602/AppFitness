import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, type TextStyle } from 'react-native';

import { AuthTextField } from './auth-text-field';

const field = (error?: string) => (
  <AuthTextField
    label="Email"
    testID="input-forgot-email"
    value=""
    onChangeText={() => {}}
    error={error}
  />
);

const liveNodes = () =>
  screen.container.queryAll(
    (node) =>
      typeof node.type === 'string' &&
      (node.props?.['aria-live'] !== undefined ||
        node.props?.accessibilityLiveRegion !== undefined),
  );

const flattenStyle = (node: { props: { style?: unknown } }): TextStyle =>
  Object.assign({}, ...[node.props.style].flat(Infinity)) as TextStyle;

afterEach(() => {
  jest.restoreAllMocks();
});

// BUG-034: Android announces a live region when its text changes, never when it
// mounts. Prop evidence only; the announcement itself was verified with TalkBack.
describe('AuthTextField inline error on Android', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  it('keeps one empty, zero-height live text mounted while there is no error', async () => {
    await render(field());

    expect(liveNodes()).toHaveLength(1);
    expect(liveNodes()[0]).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(liveNodes()[0]).toHaveTextContent('');
    expect(flattenStyle(liveNodes()[0]).height).toBe(0);
    expect(screen.queryByTestId('input-forgot-email-error')).toBeNull();
  });

  it('writes the error into that same live text', async () => {
    const view = await render(field());
    const before = liveNodes()[0];

    await view.rerender(field('Enter the email address for your account.'));

    expect(liveNodes()).toHaveLength(1);
    expect(liveNodes()[0]).toBe(before);
    expect(screen.getByTestId('input-forgot-email-error')).toHaveTextContent(
      'Enter the email address for your account.',
    );
    expect(flattenStyle(before).height).toBeUndefined();
    expect(before.props['aria-live']).toBeUndefined();
  });
});

describe('AuthTextField inline error on Web', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
  });

  it('renders no live node without an error, and aria-live on the message with one', async () => {
    const view = await render(field());
    expect(liveNodes()).toHaveLength(0);

    await view.rerender(field('Enter the email address for your account.'));

    expect(liveNodes()).toHaveLength(1);
    expect(screen.getByTestId('input-forgot-email-error')).toHaveProp('aria-live', 'polite');
    expect(
      screen.getByTestId('input-forgot-email-error').props.accessibilityLiveRegion,
    ).toBeUndefined();
  });
});

describe('AuthTextField Web submit (BUG-035)', () => {
  it('forwards onWebSubmit to the input on Web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const onWebSubmit = jest.fn();
    await render(
      <AuthTextField
        label="Email"
        testID="input-forgot-email"
        value="a@b.test"
        onChangeText={() => {}}
        onWebSubmit={onWebSubmit}
      />,
    );

    const input = screen.getByTestId('input-forgot-email');
    expect(input.props.blurOnSubmit).toBe(false);
    await fireEvent(input, 'submitEditing', { nativeEvent: { text: 'a@b.test' } });
    expect(onWebSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not wire submission on native', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const onWebSubmit = jest.fn();
    await render(
      <AuthTextField
        label="Email"
        testID="input-forgot-email"
        value=""
        onChangeText={() => {}}
        onWebSubmit={onWebSubmit}
      />,
    );

    expect(screen.getByTestId('input-forgot-email').props.onSubmitEditing).toBeUndefined();
  });
});
