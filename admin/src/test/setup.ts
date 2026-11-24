import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { setUnauthorizedHandler } from '../api/client';

afterEach(() => {
  cleanup();
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/admin/');
});
