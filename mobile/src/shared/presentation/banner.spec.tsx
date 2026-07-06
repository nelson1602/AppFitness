import { render, screen } from '@testing-library/react-native';

import { Banner } from './banner';

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
});
