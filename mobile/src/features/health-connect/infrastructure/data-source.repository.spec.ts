import { queryFirst, run } from '@/shared/infrastructure/database';

import { readPickedSource, writePickedSource } from './data-source.repository';

jest.mock('@/shared/infrastructure/database', () => ({
  queryFirst: jest.fn(),
  run: jest.fn(() => Promise.resolve()),
}));

const query = jest.mocked(queryFirst);

beforeEach(() => jest.clearAllMocks());

describe('picked Health Connect source (local, per account, never synced)', () => {
  it('reads the account’s own key', async () => {
    query.mockResolvedValueOnce({ value: 'com.sec.android.app.shealth' });
    expect(await readPickedSource('u1')).toBe('com.sec.android.app.shealth');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('app_metadata'), [
      'health-source:u1',
    ]);
  });

  it.each([[null], [{ value: '' }], [{ value: 'not a package' }], [{ value: 'nodots' }]])(
    'no pick, or an unusable value (%p): automatic',
    async (row) => {
      query.mockResolvedValueOnce(row);
      expect(await readPickedSource('u1')).toBeNull();
    },
  );

  it('saves a pick, and clears it back to automatic', async () => {
    await writePickedSource('u1', 'com.hihonor.health');
    expect(run).toHaveBeenLastCalledWith(expect.stringContaining('INSERT OR REPLACE'), [
      'health-source:u1',
      'com.hihonor.health',
    ]);
    await writePickedSource('u1', null);
    expect(run).toHaveBeenLastCalledWith(expect.stringContaining('DELETE'), ['health-source:u1']);
  });
});
