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

  // BUG-038: a browser screen reader does not announce a live region inserted
  // already holding text. Every Web Banner, whatever its tone, carries one
  // persistent, empty announcement text and records its first layout; an error
  // then writes the plain-text "title. body" into that existing node. While the
  // tone is `error` the visible title and body are hidden from assistive
  // technology, so browse mode meets the error once; other tones clear the node
  // and expose their visible content. The root is not a live region on Web.
  // Verified with NVDA + Chrome in English and Spanish, on one mounted Banner
  // through the transitions below. Prop evidence only here.
  describe('Web error announcement (BUG-038)', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
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
    // The visible text with this content, never the announcement text (which
    // equals the title for a title-only error).
    const text = (value: string) => {
      const matches = screen
        .getAllByText(value, { includeHiddenElements: true })
        .filter((node) => node.props.testID !== 'banner-announcement');
      expect(matches).toHaveLength(1);
      return matches[0];
    };
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

    it.each(['info', 'success', 'warning', 'error'] as const)(
      'mounts a %s Banner with one empty announcement text and records its first layout',
      async (tone) => {
        await render(banner(tone, `tone-${tone}`, 'Body'));

        expect(announcement()).toHaveTextContent('');
        expect(summaryRoot().props.onLayout).toEqual(expect.any(Function));

        await layOut();

        expect(summaryRoot().props.onLayout).toBeUndefined();
      },
    );

    it('keeps exactly one live node: the zero-size announcement text, never the root or the visible text', async () => {
      await render(banner('error', 'Sign-in failed', 'Try again.'));
      await layOut();

      expect(liveNodes()).toHaveLength(1);
      expect(liveNodes()[0]).toBe(announcement());
      expect(announcement()).toHaveProp('aria-live', 'polite');
      expect(announcement().props.accessibilityLiveRegion).toBeUndefined();
      expect(announcement()).toHaveStyle({ position: 'absolute', width: 0, height: 0 });
      expect(summaryRoot().props['aria-live']).toBeUndefined();
    });

    it('writes a mounted error into the existing node after layout and hides the visible text from assistive technology', async () => {
      await render(banner('error', 'Sign-in failed', 'That email or password is incorrect.'));

      // Rendered synchronously, but hidden from assistive technology.
      expect(text('Sign-in failed')).toHaveProp('aria-hidden', true);
      expect(text('That email or password is incorrect.')).toHaveProp('aria-hidden', true);
      expect(screen.queryByText('Sign-in failed')).toBeNull();
      expect(announcement()).toHaveTextContent('');

      await layOut();

      expect(announcement()).toHaveTextContent(
        'Sign-in failed. That email or password is incorrect.',
      );
      expect(text('Sign-in failed')).toHaveProp('aria-hidden', true);
      expect(text('That email or password is incorrect.')).toHaveProp('aria-hidden', true);
    });

    it.each(['info', 'success', 'warning'] as const)(
      'keeps a %s Banner silent and its visible content exposed',
      async (tone) => {
        await render(banner(tone, `tone-${tone}`, 'Body'));
        await layOut();

        expect(announcement()).toHaveTextContent('');
        expect(screen.getByText(`tone-${tone}`).props['aria-hidden']).toBeUndefined();
        expect(screen.getByText('Body').props['aria-hidden']).toBeUndefined();
      },
    );

    // Regression for the rejected Option 2: a Banner mounted as a non-error
    // never received a later layout, so its first error stayed hidden and silent.
    it('follows every rerender transition on the same announcement node', async () => {
      const view = await render(banner('info', 'Purchase pending', 'Waiting for the store.'));
      await layOut();
      const node = announcement();
      const expectError = (title: string, body: string) => {
        expect(announcement()).toBe(node);
        expect(announcement()).toHaveTextContent(`${title}. ${body}`);
        expect(text(title)).toHaveProp('aria-hidden', true);
        expect(text(body)).toHaveProp('aria-hidden', true);
      };
      const expectQuiet = (title: string, body: string) => {
        expect(announcement()).toBe(node);
        expect(announcement()).toHaveTextContent('');
        expect(screen.getByText(title).props['aria-hidden']).toBeUndefined();
        expect(screen.getByText(body).props['aria-hidden']).toBeUndefined();
      };

      // Non-error → error.
      await view.rerender(banner('error', "The purchase didn't go through", 'Try again.'));
      expectError("The purchase didn't go through", 'Try again.');

      // Error → non-error → error again.
      await view.rerender(banner('info', 'Purchase pending', 'Waiting for the store.'));
      expectQuiet('Purchase pending', 'Waiting for the store.');
      await view.rerender(banner('error', "The purchase didn't go through", 'Try again.'));
      expectError("The purchase didn't go through", 'Try again.');

      // Error A → error B.
      await view.rerender(banner('error', "We couldn't restore purchases", 'Try again later.'));
      expectError("We couldn't restore purchases", 'Try again later.');

      // An identical re-render changes nothing, so nothing is re-announced.
      await view.rerender(banner('error', "We couldn't restore purchases", 'Try again later.'));
      expectError("We couldn't restore purchases", 'Try again later.');

      // Error → success.
      await view.rerender(banner('success', 'Purchases restored', 'Pro is active.'));
      expectQuiet('Purchases restored', 'Pro is active.');
      expect(summaryRoot().props['aria-live']).toBeUndefined();
    });

    it('flattens a multi-part textual body completely and hides it', async () => {
      const name = 'Ana';
      const count = 3;
      await render(
        <Banner title="Couldn't sync" tone="error">
          {name} has {count} changes waiting.
        </Banner>,
      );
      await layOut();

      expect(announcement()).toHaveTextContent("Couldn't sync. Ana has 3 changes waiting.");
      expect(text('Ana has 3 changes waiting.')).toHaveProp('aria-hidden', true);
    });

    it.each([
      ['an element', <AppText key="d">details</AppText>],
      ['text mixed with an element', ['See ', <AppText key="d">details</AppText>]],
    ])('never hides a body holding %s, and announces the title alone', async (_label, body) => {
      await render(
        <Banner title="Couldn't sync" tone="error">
          {body}
        </Banner>,
      );
      await layOut();

      expect(announcement()).toHaveTextContent("Couldn't sync");
      expect(text("Couldn't sync")).toHaveProp('aria-hidden', true);
      // Found without `includeHiddenElements`: the body stays exposed.
      expect(screen.getByText('details')).toBeOnTheScreen();
    });

    it('announces the title alone for a title-only error Banner', async () => {
      await render(<Banner title="Couldn't save" tone="error" />);
      await layOut();

      expect(announcement()).toHaveTextContent("Couldn't save");
      expect(text("Couldn't save")).toHaveProp('aria-hidden', true);
    });
  });

  it('keeps an iOS error Banner exposed with no layout wait', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(
      <Banner title="Sign-in failed" tone="error">
        Try again.
      </Banner>,
    );

    expect(screen.getByText('Sign-in failed').props['aria-hidden']).toBeUndefined();
    expect(screen.getByText('Try again.').props['aria-hidden']).toBeUndefined();
    expect(summaryRoot().props.onLayout).toBeUndefined();
  });

  it('renders no announcement text on iOS and keeps the root request', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(
      <Banner title="Sign-in failed" tone="error">
        Try again.
      </Banner>,
    );

    expect(screen.queryByTestId('banner-announcement')).toBeNull();
    expect(summaryRoot()).toHaveProp('aria-live', 'polite');
  });
});
