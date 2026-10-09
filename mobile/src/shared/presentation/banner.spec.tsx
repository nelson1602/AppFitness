import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { AppText } from './app-text';
import { Banner } from './banner';

// The root View is not `accessible`, so `getByRole` does not match it; query
// the single host node that carries the `summary` role instead.
function summaryRoot() {
  const roots = screen.container.queryAll((node) => node.props?.accessibilityRole === 'summary');
  expect(roots).toHaveLength(1);
  return roots[0];
}

describe('Banner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders title and body', async () => {
    await render(
      <Banner title="Local data ready" tone="success">
        Dashboard is available offline.
      </Banner>,
    );

    expect(screen.getByText('Local data ready')).toBeOnTheScreen();
    expect(screen.getByText('Dashboard is available offline.')).toBeOnTheScreen();
  });

  it('renders title-only banners without an empty body node', async () => {
    await render(<Banner title="Syncing" tone="info" />);

    expect(screen.getByText('Syncing')).toBeOnTheScreen();
  });

  it('supports every tone without crashing', async () => {
    for (const tone of ['info', 'success', 'warning', 'error'] as const) {
      await render(<Banner title={`tone-${tone}`} tone={tone} />);
      expect(screen.getByText(`tone-${tone}`)).toBeOnTheScreen();
    }
  });

  // BUG-025 (ADR-P024 bounded extension). These assertions prove prop presence
  // on the Banner root only — never that TalkBack, VoiceOver or a browser
  // screen reader announced anything. That needs the UX-4C manual pass.
  describe('error announcement request', () => {
    it('puts aria-live="polite" on the summary root of an error Banner', async () => {
      await render(
        <Banner title="Couldn't save" tone="error">
          Try again.
        </Banner>,
      );

      expect(summaryRoot()).toHaveProp('aria-live', 'polite');
      expect(screen.getByText("Couldn't save")).toBeOnTheScreen();
      expect(screen.getByText('Try again.')).toBeOnTheScreen();
    });

    it.each(['info', 'success', 'warning'] as const)(
      'gives a %s Banner no live-region prop',
      async (tone) => {
        await render(<Banner title={`tone-${tone}`} tone={tone} />);

        const root = summaryRoot();
        expect(root.props['aria-live']).toBeUndefined();
        expect(root.props.accessibilityLiveRegion).toBeUndefined();
        expect(screen.getByText(`tone-${tone}`)).toBeOnTheScreen();
      },
    );

    it('gives the default-tone Banner no live-region prop', async () => {
      await render(<Banner title="Default" />);

      const root = summaryRoot();
      expect(root.props['aria-live']).toBeUndefined();
      expect(root.props.accessibilityLiveRegion).toBeUndefined();
    });

    it('marks only the root, without duplicating the title or body', async () => {
      await render(
        <Banner title="Sync failed" tone="error">
          Your changes are safe on this device.
        </Banner>,
      );

      const announcing = screen.container.queryAll(
        (node) =>
          node.props?.['aria-live'] !== undefined ||
          node.props?.accessibilityLiveRegion !== undefined,
      );
      expect(announcing.map((node) => node.props.accessibilityRole)).toEqual(['summary']);
      expect(screen.getAllByText('Sync failed')).toHaveLength(1);
      expect(screen.getAllByText('Your changes are safe on this device.')).toHaveLength(1);
    });
  });

  // BUG-034: Android announces a live region only when an attached view's text
  // changes. Every Android Banner carries one persistent, zero-size announcement
  // text; the visible title and body render synchronously and are not live.
  // Each transition below was verified with real TalkBack (one announcement per
  // new error, silence otherwise). Prop evidence only here.
  describe('Android error announcement (BUG-034)', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const liveNodes = () =>
      screen.container.queryAll(
        (node) =>
          typeof node.type === 'string' &&
          (node.props?.['aria-live'] !== undefined ||
            node.props?.accessibilityLiveRegion !== undefined),
      );
    const announcement = () => screen.getByTestId('banner-announcement');
    const layOut = async () => {
      await fireEvent(summaryRoot(), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 80 } },
      });
    };
    const banner = (
      tone: 'info' | 'success' | 'warning' | 'error',
      title: string,
      body?: string,
    ) => (
      <Banner title={title} tone={tone}>
        {body}
      </Banner>
    );

    it('renders title and body synchronously and announces a mounted error only after layout', async () => {
      await render(banner('error', 'Sign-in failed', 'That email or password is incorrect.'));

      // Visible content is there from the first render; nothing is live yet.
      expect(screen.getByText('Sign-in failed')).toBeOnTheScreen();
      expect(screen.getByText('That email or password is incorrect.')).toBeOnTheScreen();
      expect(announcement()).toHaveTextContent('');

      await layOut();

      expect(announcement()).toHaveTextContent(
        'Sign-in failed. That email or password is incorrect.',
      );
      expect(summaryRoot().props.onLayout).toBeUndefined();
    });

    it('keeps exactly one live node: the zero-size announcement text, never the visible text', async () => {
      await render(banner('error', 'Sign-in failed', 'Try again.'));
      await layOut();

      expect(liveNodes()).toHaveLength(1);
      expect(liveNodes()[0]).toBe(announcement());
      expect(announcement()).toHaveProp('accessibilityLiveRegion', 'polite');
      expect(announcement()).toHaveStyle({ position: 'absolute', width: 0, height: 0 });
      expect(summaryRoot().props['aria-live']).toBeUndefined();
      expect(screen.getByText('Sign-in failed').props.accessibilityLiveRegion).toBeUndefined();
      expect(screen.getByText('Try again.').props.accessibilityLiveRegion).toBeUndefined();
    });

    it('stays silent on a clean non-error render', async () => {
      await render(banner('info', 'Saved on this device', 'Waiting to sync.'));
      await layOut();

      expect(announcement()).toHaveTextContent('');
    });

    it('follows every rerender transition on the same announcement node', async () => {
      const view = await render(banner('info', 'Saved', 'Waiting to sync.'));
      await layOut();
      const node = announcement();
      const expectText = (text: string) => {
        expect(announcement()).toBe(node);
        expect(announcement()).toHaveTextContent(text);
      };

      // Non-error transitions stay silent.
      await view.rerender(banner('warning', 'Check your connection', 'Changes are queued.'));
      expectText('');
      await view.rerender(banner('success', 'Synced', 'Everything is up to date.'));
      expectText('');

      // Non-error → error announces the error.
      await view.rerender(banner('error', 'Sign-in failed', 'Error A.'));
      expectText('Sign-in failed. Error A.');

      // Error → non-error clears it; error again announces again.
      await view.rerender(banner('info', 'Saved', 'Waiting to sync.'));
      expectText('');
      await view.rerender(banner('error', 'Sign-in failed', 'Error A.'));
      expectText('Sign-in failed. Error A.');

      // A different error replaces it.
      await view.rerender(banner('error', 'Something went wrong', 'Error B.'));
      expectText('Something went wrong. Error B.');

      // A locale change while the error stays active is a text change.
      await view.rerender(banner('error', 'Algo salió mal', 'Error B en español.'));
      expectText('Algo salió mal. Error B en español.');

      // Re-rendering the same error changes nothing, so nothing is re-announced.
      await view.rerender(banner('error', 'Algo salió mal', 'Error B en español.'));
      expectText('Algo salió mal. Error B en español.');
    });

    it('announces the title alone for a title-only or non-text-body error Banner', async () => {
      const view = await render(<Banner title="Couldn't save" tone="error" />);
      await layOut();
      expect(announcement()).toHaveTextContent("Couldn't save");

      await view.rerender(
        <Banner title="Couldn't sync" tone="error">
          <AppText>Details</AppText>
        </Banner>,
      );
      expect(announcement()).toHaveTextContent("Couldn't sync");
    });
  });

  it.each(['ios', 'web'] as const)('renders no announcement text on %s', async (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    await render(
      <Banner title="Sign-in failed" tone="error">
        Try again.
      </Banner>,
    );

    expect(screen.queryByTestId('banner-announcement')).toBeNull();
    expect(summaryRoot()).toHaveProp('aria-live', 'polite');
  });
});
