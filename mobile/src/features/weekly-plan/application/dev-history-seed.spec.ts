import { isLocalApi } from './dev-history-seed';

jest.mock('@/features/authentication', () => ({
  getSession: () => null,
  bindStoreToSession: jest.fn(),
}));

describe('dev history seed guard (owner decision 9)', () => {
  it('runs only against a local API', () => {
    expect(isLocalApi('http://127.0.0.1:3001')).toBe(true);
    expect(isLocalApi('http://localhost:3001')).toBe(true);
    expect(isLocalApi('http://10.0.2.2:3001')).toBe(true);
    expect(isLocalApi(undefined)).toBe(true);
    expect(isLocalApi('https://appfitness-api-development.up.railway.app')).toBe(false);
    expect(isLocalApi('https://api.appfitnessrd.com')).toBe(false);
    expect(isLocalApi('http://127.0.0.1.evil.example')).toBe(false);
  });
});
