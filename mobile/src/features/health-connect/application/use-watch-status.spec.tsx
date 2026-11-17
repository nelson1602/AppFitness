import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useHealthConnectStore } from './health-connect.store';
import { useWatchStatus } from './use-watch-status';

let mockSession: { user: { id: string } } | null = null;
jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockSession ? 'authenticated' : 'unknown', session: mockSession }),
}));
jest.mock('@/shared/application/local-day', () => ({
  useLocalDay: (select: (s: { today: string }) => unknown) => select({ today: '2026-11-17' }),
}));

const refresh = jest.fn(() => Promise.resolve());

function Probe() {
  return <Text testID="status">{String(useWatchStatus())}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = null;
  useHealthConnectStore.setState({ status: null, userId: null, refresh });
});

describe('useWatchStatus (ADR-P048)', () => {
  it('reads once the session arrives after the screen mounted (cold start from Health Connect)', async () => {
    // Emulator, 2026-11-17: opened straight on /health-connect, the screen
    // rendered before the session restored and never read Health Connect.
    const view = await render(<Probe />);
    expect(refresh).not.toHaveBeenCalled();

    mockSession = { user: { id: 'u1' } };
    await view.rerender(<Probe />);

    expect(refresh).toHaveBeenCalledWith('2026-11-17');
  });

  it('shows another account’s cached status as unknown', async () => {
    mockSession = { user: { id: 'u2' } };
    useHealthConnectStore.setState({ status: 'connected', userId: 'u1' });
    const view = await render(<Probe />);
    expect(view.getByTestId('status')).toHaveTextContent('null');
  });
});
