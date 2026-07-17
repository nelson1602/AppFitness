import { getSession } from '../../authentication';
import type { DietaryPreference, DietaryPreferenceInput } from '../domain/dietary-preference';
import {
  createDietaryPreference,
  deleteDietaryPreference,
  listActiveDietaryPreferences,
} from '../infrastructure/dietary-preference.repository';
import {
  addDietaryPreference,
  getMyDietaryPreferences,
  removeDietaryPreference,
} from './dietary-preference.service';

jest.mock('../../authentication', () => ({ getSession: jest.fn() }));
jest.mock('../infrastructure/dietary-preference.repository', () => ({
  createDietaryPreference: jest.fn(),
  deleteDietaryPreference: jest.fn(),
  listActiveDietaryPreferences: jest.fn(),
}));

const mockSession = jest.mocked(getSession);
const mockCreate = jest.mocked(createDietaryPreference);
const mockDelete = jest.mocked(deleteDietaryPreference);
const mockList = jest.mocked(listActiveDietaryPreferences);

const input: DietaryPreferenceInput = {
  exclusionType: 'avoid_tag',
  avoidTag: 'nut_allergy',
  kind: 'allergy',
};

function signedIn() {
  mockSession.mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof getSession>);
}

beforeEach(() => {
  jest.clearAllMocks();
  signedIn();
});

describe('dietary-preference.service', () => {
  it('addDietaryPreference resolves the session user and delegates to the repository', async () => {
    mockCreate.mockResolvedValue({ id: 'dp-1' } as DietaryPreference);
    const result = await addDietaryPreference(input);
    expect(mockCreate).toHaveBeenCalledWith('user-1', input);
    expect(result).toEqual({ id: 'dp-1' });
  });

  it('getMyDietaryPreferences lists active entries for the session user', async () => {
    mockList.mockResolvedValue([]);
    await getMyDietaryPreferences();
    expect(mockList).toHaveBeenCalledWith('user-1');
  });

  it('removeDietaryPreference soft-deletes by id for the session user', async () => {
    mockDelete.mockResolvedValue(undefined);
    await removeDietaryPreference('dp-1');
    expect(mockDelete).toHaveBeenCalledWith('user-1', 'dp-1');
  });

  it('never passes a caller-supplied user id (session is the only source)', async () => {
    mockList.mockResolvedValue([]);
    await getMyDietaryPreferences();
    // The service takes no userId argument; it comes from the session.
    expect(mockList.mock.calls[0][0]).toBe('user-1');
  });

  describe('when there is no session', () => {
    beforeEach(() => mockSession.mockReturnValue(null));

    it('add/get/remove all throw "Not authenticated" and never touch the repository', () => {
      expect(() => addDietaryPreference(input)).toThrow('Not authenticated');
      expect(() => getMyDietaryPreferences()).toThrow('Not authenticated');
      expect(() => removeDietaryPreference('dp-1')).toThrow('Not authenticated');
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockList).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
