import { getSession } from '@/features/authentication';

import {
  createBodyMeasurement,
  createBodyWeight,
  listBodyMeasurements,
  listBodyWeights,
} from '../infrastructure/progress.repository';
import {
  getMyLatestPhysicalAssessment,
  recordMyBodyMeasurement,
  recordMyBodyWeight,
} from './progress.service';

jest.mock('@/features/authentication', () => ({ getSession: jest.fn() }));
jest.mock('../infrastructure/progress.repository', () => ({
  createBodyMeasurement: jest.fn(),
  createBodyWeight: jest.fn(),
  listBodyMeasurements: jest.fn(),
  listBodyWeights: jest.fn(),
}));

const session = { user: { id: 'user-1' } } as ReturnType<typeof getSession>;

describe('progress service physical assessment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getSession).mockReturnValue(session);
    jest.mocked(listBodyWeights).mockResolvedValue([]);
    jest.mocked(listBodyMeasurements).mockResolvedValue([]);
  });

  it('reads the latest wellness metrics without consulting the medical feature', async () => {
    jest.mocked(listBodyWeights).mockResolvedValue([{ weightKg: 82 }] as never);
    jest.mocked(listBodyMeasurements).mockResolvedValue([{ bodyFatPct: 21 }] as never);

    await expect(getMyLatestPhysicalAssessment()).resolves.toEqual({
      weightKg: 82,
      bodyFatPct: 21,
    });
    expect(listBodyWeights).toHaveBeenCalledWith('user-1', 1);
    expect(listBodyMeasurements).toHaveBeenCalledWith('user-1', 1);
  });

  it('returns nullable metrics when the wellness baseline is empty', async () => {
    await expect(getMyLatestPhysicalAssessment()).resolves.toEqual({
      weightKg: null,
      bodyFatPct: null,
    });
  });

  it('keeps public writes in the progress repositories', async () => {
    await recordMyBodyWeight({ date: '2026-08-10', weightKg: 82 });
    await recordMyBodyMeasurement({ date: '2026-08-10', waistCm: 84 });

    expect(createBodyWeight).toHaveBeenCalledWith('user-1', {
      date: '2026-08-10',
      weightKg: 82,
    });
    expect(createBodyMeasurement).toHaveBeenCalledWith('user-1', {
      date: '2026-08-10',
      waistCm: 84,
    });
  });

  it('rejects access without a session', async () => {
    jest.mocked(getSession).mockReturnValue(null);
    await expect(getMyLatestPhysicalAssessment()).rejects.toThrow('Not authenticated');
  });
});
