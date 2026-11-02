import { getSession } from '../../authentication';
import type { Session } from '../../authentication/domain/session.types';
import type { Profile, ProfileInput } from '../domain/profile.types';
import { getProfile, saveProfile } from '../infrastructure/profile.repository';
import {
  forgetSignupCountry,
  readSignupCountry,
  rememberSignupCountry,
} from '../infrastructure/signup-country.storage';
import { getMyProfile, rememberMySignupCountry, saveMyProfile } from './profile.service';

jest.mock('../../authentication', () => ({
  getSession: jest.fn(),
}));
jest.mock('../infrastructure/profile.repository', () => ({
  getProfile: jest.fn(),
  saveProfile: jest.fn(),
}));
jest.mock('../infrastructure/signup-country.storage', () => ({
  forgetSignupCountry: jest.fn(),
  readSignupCountry: jest.fn(),
  rememberSignupCountry: jest.fn(),
}));

const mockGetSession = jest.mocked(getSession);
const mockGetProfile = jest.mocked(getProfile);
const mockSaveProfile = jest.mocked(saveProfile);
const mockReadSignupCountry = jest.mocked(readSignupCountry);
const mockForgetSignupCountry = jest.mocked(forgetSignupCountry);

const session: Session = {
  accessToken: 'a',
  refreshToken: 'r',
  user: {
    id: 'user-1',
    email: 'demo@appfitness.local',
    username: 'demo',
    role: 'USER',
    phone: null,
    avatarUrl: null,
  },
};

const profile = { id: 'p1', userId: 'user-1' } as unknown as Profile;
const input: ProfileInput = { birthDate: '1990-05-14', heightCm: 178, equipment: [] };

describe('profile service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockReturnValue(session);
    mockReadSignupCountry.mockResolvedValue(null);
  });

  it('reads the current user profile via the repository', async () => {
    mockGetProfile.mockResolvedValue(profile);

    await expect(getMyProfile()).resolves.toBe(profile);
    expect(mockGetProfile).toHaveBeenCalledWith('user-1');
  });

  it('saves the current user profile via the repository', async () => {
    mockSaveProfile.mockResolvedValue(profile);

    await expect(saveMyProfile(input)).resolves.toBe(profile);
    expect(mockSaveProfile).toHaveBeenCalledWith('user-1', input, undefined, {
      countryForNewProfile: undefined,
    });
    expect(mockForgetSignupCountry).not.toHaveBeenCalled();
  });

  describe('the sign-up country (v8.1)', () => {
    it('is offered to the save that creates the profile, then forgotten', async () => {
      mockReadSignupCountry.mockResolvedValue({ userId: 'user-1', country: 'MX' });
      mockSaveProfile.mockResolvedValue(profile);

      await saveMyProfile(input);

      expect(mockSaveProfile).toHaveBeenCalledWith('user-1', input, undefined, {
        countryForNewProfile: 'MX',
      });
      expect(mockForgetSignupCountry).toHaveBeenCalledTimes(1);
    });

    it('is never applied to another account, and is still cleared', async () => {
      mockReadSignupCountry.mockResolvedValue({ userId: 'someone-else', country: 'MX' });
      mockSaveProfile.mockResolvedValue(profile);

      await saveMyProfile(input);

      expect(mockSaveProfile).toHaveBeenCalledWith('user-1', input, undefined, {
        countryForNewProfile: undefined,
      });
      expect(mockForgetSignupCountry).toHaveBeenCalledTimes(1);
    });

    it('is not read when the input names a country', async () => {
      mockSaveProfile.mockResolvedValue(profile);

      await saveMyProfile({ ...input, country: 'US' });

      expect(mockReadSignupCountry).not.toHaveBeenCalled();
      expect(mockSaveProfile).toHaveBeenCalledWith(
        'user-1',
        { ...input, country: 'US' },
        undefined,
        { countryForNewProfile: undefined },
      );
    });

    it('is not forgotten when the save fails', async () => {
      mockReadSignupCountry.mockResolvedValue({ userId: 'user-1', country: 'MX' });
      mockSaveProfile.mockRejectedValue(new Error('disk'));

      await expect(saveMyProfile(input)).rejects.toThrow('disk');
      expect(mockForgetSignupCountry).not.toHaveBeenCalled();
    });

    it('is remembered for the account that signed up', async () => {
      await rememberMySignupCountry('user-1', 'CO');
      expect(jest.mocked(rememberSignupCountry)).toHaveBeenCalledWith({
        userId: 'user-1',
        country: 'CO',
      });
    });
  });

  it('refuses to read without an authenticated session', () => {
    mockGetSession.mockReturnValue(null);

    expect(() => getMyProfile()).toThrow('Not authenticated');
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it('refuses to save without an authenticated session', () => {
    mockGetSession.mockReturnValue(null);

    expect(() => saveMyProfile(input)).toThrow('Not authenticated');
    expect(mockSaveProfile).not.toHaveBeenCalled();
  });
});
