import { canSeedDevHistory, isLocalApi, seedDevHistory } from './dev-history-seed';

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

// v8.1 round 2 (item 8): "Cargar 4 semanas de ejemplo (desarrollo)" never
// reaches a release build. Release bundles compile __DEV__ to false.
describe('dev history seed in a release build', () => {
  const devFlag = (globalThis as unknown as { __DEV__: boolean }).__DEV__;
  afterEach(() => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = devFlag;
  });

  it('is offered only in a development build', () => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
    expect(canSeedDevHistory()).toBe(false);
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
    expect(canSeedDevHistory()).toBe(isLocalApi(process.env.EXPO_PUBLIC_API_URL));
  });

  it('refuses to seed in a release build even if called', async () => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
    await expect(seedDevHistory('Entrenamiento')).rejects.toThrow('development build');
  });
});
