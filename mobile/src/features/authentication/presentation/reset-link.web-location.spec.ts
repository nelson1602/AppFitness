import { currentWebHistory, currentWebLocation } from './reset-link.web-location';

let mockPlatformOS: 'web' | 'ios' | 'android' = 'ios';

// Only `Platform` is used by the module under test; a minimal mock keeps this
// spec from pulling in the whole React Native runtime.
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

type Mutable = {
  location?: unknown;
  history?: unknown;
};

const globals = globalThis as Mutable;

describe('currentWebLocation / currentWebHistory', () => {
  let priorLocation: unknown;
  let priorHistory: unknown;

  beforeEach(() => {
    priorLocation = globals.location;
    priorHistory = globals.history;
    mockPlatformOS = 'ios';
  });

  afterEach(() => {
    globals.location = priorLocation;
    globals.history = priorHistory;
  });

  it('returns null on native even when a location-like global exists', () => {
    // A native runtime must never take the browser path, whatever globals a
    // polyfill happens to define.
    globals.location = { pathname: '/reset-password', search: '', hash: '#token=x' };
    globals.history = { replaceState: jest.fn() };
    mockPlatformOS = 'ios';

    expect(currentWebLocation()).toBeNull();
    expect(currentWebHistory()).toBeNull();
  });

  it('returns the browser location and history on Web', () => {
    const location = { pathname: '/reset-password', search: '', hash: '#token=x' };
    const history = { replaceState: jest.fn() };
    globals.location = location;
    globals.history = history;
    mockPlatformOS = 'web';

    expect(currentWebLocation()).toBe(location);
    expect(currentWebHistory()).toBe(history);
  });

  it('returns null on Web when the globals are missing or malformed', () => {
    mockPlatformOS = 'web';

    globals.location = undefined;
    globals.history = undefined;
    expect(currentWebLocation()).toBeNull();
    expect(currentWebHistory()).toBeNull();

    // A `location` without a string hash, or a `history` without
    // replaceState, is not usable — fall back to null rather than throwing
    // inside the reset route.
    globals.location = { pathname: '/x', search: '', hash: 42 };
    globals.history = { replaceState: 'not-a-function' };
    expect(currentWebLocation()).toBeNull();
    expect(currentWebHistory()).toBeNull();
  });
});
