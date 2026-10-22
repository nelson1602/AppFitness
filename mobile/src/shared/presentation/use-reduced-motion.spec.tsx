import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReducedMotion } from './use-reduced-motion';

describe('useReducedMotion (ADR-P035 D5)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is still until the preference is known, then follows it live', async () => {
    let notify: (value: boolean) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
      notify = handler as unknown as (value: boolean) => void;
      return { remove } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
    });

    const view = await renderHook(() => useReducedMotion());
    await waitFor(() => expect(view.result.current).toBe(false));

    await act(async () => notify(true));
    expect(view.result.current).toBe(true);

    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('stays still when the preference cannot be read', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockRejectedValue(new Error('unavailable'));

    const view = await renderHook(() => useReducedMotion());
    await act(async () => {});
    expect(view.result.current).toBe(true);
  });
});
