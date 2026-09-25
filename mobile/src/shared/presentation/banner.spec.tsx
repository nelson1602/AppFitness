import { render, screen } from '@testing-library/react-native';

import { Banner } from './banner';

// The root View is not `accessible`, so `getByRole` does not match it; query
// the single host node that carries the `summary` role instead.
function summaryRoot() {
  const roots = screen.container.queryAll((node) => node.props?.accessibilityRole === 'summary');
  expect(roots).toHaveLength(1);
  return roots[0];
}

describe('Banner', () => {
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
});
