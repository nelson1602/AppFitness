import { getSession } from '../../authentication';
import type { Session } from '../../authentication/domain/session.types';
import type { Profile, ProfileInput } from '../domain/profile.types';
import { getProfile, saveProfile } from '../infrastructure/profile.repository';
import { getMyProfile, saveMyProfile } from './profile.service';

jest.mock('../../authentication', () => ({
  getSession: jest.fn(),
}));
jest.mock('../infrastructure/profile.repository', () => ({
  getProfile: jest.fn(),
  saveProfile: jest.fn(),
}));

const mockGetSession = jest.mocked(getSession);
const mockGetProfile = jest.mocked(getProfile);
const mockSaveProfile = jest.mocked(saveProfile);

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
  });

  it('reads the current user profile via the repository', async () => {
    mockGetProfile.mockResolvedValue(profile);

    await expect(getMyProfile()).resolves.toBe(profile);
    expect(mockGetProfile).toHaveBeenCalledWith('user-1');
  });

  it('saves the current user profile via the repository', async () => {
    mockSaveProfile.mockResolvedValue(profile);

    await expect(saveMyProfile(input)).resolves.toBe(profile);
    expect(mockSaveProfile).toHaveBeenCalledWith('user-1', input);
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
