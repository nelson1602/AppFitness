import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Restriction } from '../domain/medical.types';
import type { RestrictionFormState } from '../application/restriction.store';
import { Restrictions } from './Restrictions';

const load = jest.fn();
const save = jest.fn();
const deactivate = jest.fn();

let mockState: RestrictionFormState;

jest.mock('../application/restriction.store', () => ({
  useRestrictionStore: (selector?: (s: RestrictionFormState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));

function setStore(partial: Partial<RestrictionFormState>) {
  mockState = {
    status: 'ready',
    restrictions: [],
    error: null,
    load,
    save,
    deactivate,
    ...partial,
  };
}

const restriction: Restriction = {
  id: 'r1',
  userId: 'u1',
  type: 'INJURY',
  bodyArea: 'left knee',
  severity: 'MODERATE',
  notes: 'PRIVATE restriction note',
  isActive: true,
  effectiveFrom: '2026-07-09',
  effectiveUntil: null,
  version: 1,
  syncStatus: 'pending',
};

describe('Restrictions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    save.mockResolvedValue(true);
  });

  it('loads active restrictions on mount', async () => {
    setStore({ status: 'loading' });
    await render(<Restrictions />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it('shows an empty message when there are no active restrictions', async () => {
    setStore({ status: 'ready', restrictions: [] });
    await render(<Restrictions />);
    expect(screen.getByText('No active restrictions.')).toBeOnTheScreen();
  });

  it('renders an active restriction summary and sync status without notes', async () => {
    setStore({ status: 'ready', restrictions: [restriction] });
    await render(<Restrictions />);

    expect(screen.getByText('Injury · left knee · moderate')).toBeOnTheScreen();
    expect(screen.getByText('Pending sync')).toBeOnTheScreen();
    // Sensitive free-text notes are not surfaced in the list.
    expect(screen.queryByText(/PRIVATE restriction note/)).toBeNull();
  });

  it('deactivates a restriction via the End action', async () => {
    setStore({ status: 'ready', restrictions: [restriction] });
    await render(<Restrictions />);

    await fireEvent.press(screen.getByTestId('restriction-end-r1'));
    expect(deactivate).toHaveBeenCalledWith('r1');
  });

  it('surfaces a safe error banner', async () => {
    setStore({
      status: 'error',
      restrictions: [],
      error: 'Your restrictions could not be loaded right now.',
    });
    await render(<Restrictions />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
  });
});
