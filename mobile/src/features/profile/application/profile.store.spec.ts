import { logError } from '@/shared/infrastructure/logging';

import type { Profile, ProfileInput } from '../domain/profile.types';
import { getMyProfile, saveMyProfile } from './profile.service';
import { useProfileStore } from './profile.store';

jest.mock('./profile.service', () => ({
  getMyProfile: jest.fn(),
  saveMyProfile: jest.fn(),
}));
jest.mock('@/shared/infrastructure/logging', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const mockGetMyProfile = jest.mocked(getMyProfile);
const mockSaveMyProfile = jest.mocked(saveMyProfile);
const mockLogError = jest.mocked(logError);

const profile: Profile = {
  id: 'p1',
  userId: 'u1',
  birthDate: '1990-05-14',
  gender: 'MALE',
  heightCm: 178,
  fitnessLevel: 'INTERMEDIATE',
  yearsTraining: 4,
  activityLevel: 'MODERATE',
  occupation: null,
  sleepHoursBaseline: 7,
  stressLevelBaseline: 3,
  equipment: [],
  trainingDaysPerWeek: 4,
  sessionDurationMins: 60,
  targetCalories: null,
  targetProteinG: null,
  targetCarbsG: null,
  targetFatG: null,
  version: 1,
  syncStatus: 'pending',
  updatedAt: '2026-07-08T00:00:00.000Z',
};

const input: ProfileInput = {
  birthDate: '1990-05-14',
  heightCm: 178,
  gender: 'MALE',
  fitnessLevel: 'INTERMEDIATE',
  activityLevel: 'MODERATE',
  equipment: [],
};

describe('profile store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState({ status: 'idle', profile: null, error: null });
  });

  it('loads the profile and transitions idle → ready', async () => {
    mockGetMyProfile.mockResolvedValue(profile);

    await useProfileStore.getState().load();

    const state = useProfileStore.getState();
    expect(state.status).toBe('ready');
    expect(state.profile).toEqual(profile);
    expect(state.error).toBeNull();
  });

  it('surfaces a safe error and logs when load fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('sqlite is unavailable'));

    await useProfileStore.getState().load();

    const state = useProfileStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Your profile could not be loaded right now.');
    expect(state.error).not.toContain('sqlite');
    expect(mockLogError).toHaveBeenCalledWith('profile.load', expect.any(Error));
  });

  it('saves, stores the returned profile, and reports success', async () => {
    mockSaveMyProfile.mockResolvedValue(profile);

    const ok = await useProfileStore.getState().save(input);

    const state = useProfileStore.getState();
    expect(ok).toBe(true);
    expect(mockSaveMyProfile).toHaveBeenCalledWith(input);
    expect(state.status).toBe('ready');
    expect(state.profile).toEqual(profile);
    expect(state.error).toBeNull();
  });

  it('returns false, keeps a safe message, and logs when save fails', async () => {
    mockSaveMyProfile.mockRejectedValue(new Error('encryption key missing'));

    const ok = await useProfileStore.getState().save(input);

    const state = useProfileStore.getState();
    expect(ok).toBe(false);
    expect(state.status).toBe('error');
    expect(state.error).toBe('Your profile could not be saved. Please try again.');
    expect(state.error).not.toContain('encryption');
    expect(mockLogError).toHaveBeenCalledWith('profile.save', expect.any(Error));
  });
});
