import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { getServerSnapshot, useTheme } from './use-theme.web';

function Probe() {
  return <>{useTheme().dark ? 'dark' : 'light'}</>;
}

describe('Web theme subscription', () => {
  let dark = false;
  let query: MediaQueryList;
  const listeners = new Set<() => void>();

  beforeEach(() => {
    dark = false;
    listeners.clear();
    query = {
      get matches() {
        return dark;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
      addListener: (listener: () => void) => {
        listeners.add(listener);
      },
      removeListener: (listener: () => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: () => query,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'matchMedia');
  });

  it('keeps the deterministic light server snapshot even for a dark visitor', () => {
    dark = true;
    expect(getServerSnapshot()).toBe(false);
  });

  it('renders the browser preference and follows later system changes', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe />);
    });
    expect(renderer!.toJSON()).toBe('light');
    expect(listeners.size).toBe(1);

    act(() => {
      dark = true;
      listeners.forEach((listener) => listener());
    });
    expect(renderer!.toJSON()).toBe('dark');

    act(() => renderer!.unmount());
    expect(listeners.size).toBe(0);
  });

  it('fails safely to light when matchMedia is unavailable', () => {
    Reflect.deleteProperty(globalThis, 'matchMedia');

    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe />);
    });
    expect(renderer!.toJSON()).toBe('light');

    act(() => renderer!.unmount());
  });

  it('supports and cleans up the legacy MediaQueryList listener API', () => {
    Object.defineProperty(query, 'addEventListener', { value: undefined });
    Object.defineProperty(query, 'removeEventListener', { value: undefined });

    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe />);
    });
    expect(listeners.size).toBe(1);

    act(() => {
      dark = true;
      listeners.forEach((listener) => listener());
    });
    expect(renderer!.toJSON()).toBe('dark');

    act(() => renderer!.unmount());
    expect(listeners.size).toBe(0);
  });
});
