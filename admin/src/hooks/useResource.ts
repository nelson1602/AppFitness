import { useCallback, useEffect, useRef, useState } from 'react';

interface ResourceState<T> {
  key: string;
  data: T | undefined;
  error: unknown;
}

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data for `key` and reloads whenever the key changes or `reload()` is
 * called. Stale data stays visible while a reload is in flight.
 */
export function useResource<T>(
  key: string,
  load: () => Promise<T>,
): Resource<T> {
  const [state, setState] = useState<ResourceState<T>>({
    key: '',
    data: undefined,
    error: undefined,
  });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  const fullKey = `${key}#${nonce}`;

  useEffect(() => {
    let active = true;
    loadRef.current().then(
      (data) => {
        if (active) setState({ key: fullKey, data, error: undefined });
      },
      (error: unknown) => {
        if (active)
          setState((prev) => ({ key: fullKey, data: prev.data, error }));
      },
    );
    return () => {
      active = false;
    };
  }, [fullKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loading = state.key !== fullKey;

  return {
    data: state.data,
    error: loading ? undefined : state.error,
    loading,
    reload,
  };
}
