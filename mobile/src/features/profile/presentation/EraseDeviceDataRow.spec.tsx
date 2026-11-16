import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { countUnsyncedChanges, signOutAndEraseThisPhone } from '../application/erase-device-data';
import { EraseDeviceDataRow } from './EraseDeviceDataRow';

jest.mock('../application/erase-device-data', () => ({
  countUnsyncedChanges: jest.fn(),
  signOutAndEraseThisPhone: jest.fn(),
}));
jest.mock('@/shared/localization', () => {
  const actual =
    jest.requireActual<typeof import('@/shared/localization')>('@/shared/localization');
  const { es } = jest.requireActual<typeof import('@/shared/localization/resources/es')>(
    '@/shared/localization/resources/es',
  );
  return {
    ...actual,
    useLocalization: () => ({ language: 'es', t: (key: keyof typeof es) => es[key] }),
  };
});

const mockCount = jest.mocked(countUnsyncedChanges);
const mockErase = jest.mocked(signOutAndEraseThisPhone);

/** ADR-P047 D4: "Borrar datos de este teléfono" at sign-out. */
describe('EraseDeviceDataRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockErase.mockResolvedValue(undefined);
  });

  it('asks before erasing and warns about unsynced changes', async () => {
    mockCount.mockResolvedValue(3);
    await render(<EraseDeviceDataRow />);

    await fireEvent.press(screen.getByTestId('profile-erase-device'));

    expect(screen.getByText('¿Borrar datos de este teléfono?')).toBeOnTheScreen();
    expect(await screen.findByTestId('profile-erase-device-unsynced')).toHaveTextContent(
      /Cambios sin sincronizar: 3\./,
    );
    expect(mockErase).not.toHaveBeenCalled();
  });

  it('erases only after the explicit confirmation', async () => {
    mockCount.mockResolvedValue(0);
    await render(<EraseDeviceDataRow />);
    await fireEvent.press(screen.getByTestId('profile-erase-device'));

    expect(screen.queryByTestId('profile-erase-device-unsynced')).toBeNull();
    await fireEvent.press(screen.getByTestId('profile-erase-device-confirm-button'));

    await waitFor(() => expect(mockErase).toHaveBeenCalledTimes(1));
  });

  it('cancel goes back to the row without erasing', async () => {
    mockCount.mockResolvedValue(null);
    await render(<EraseDeviceDataRow />);
    await fireEvent.press(screen.getByTestId('profile-erase-device'));

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByTestId('profile-erase-device')).toBeOnTheScreen();
    expect(mockErase).not.toHaveBeenCalled();
  });
});
