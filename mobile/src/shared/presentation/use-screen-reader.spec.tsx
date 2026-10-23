import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useScreenReader } from './use-screen-reader';

describe('useScreenReader (ADR-P039 D5)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('assumes a reader until it knows, then follows it live', async () => {
    let notify: (value: boolean) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
      notify = handler as unknown as (value: boolean) => void;
      return { remove } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
    });

    const view = await renderHook(() => useScreenReader());
    await waitFor(() => expect(view.result.current).toBe(false));

    await act(async () => notify(true));
    expect(view.result.current).toBe(true);

    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('assumes a reader when the setting cannot be read', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
      .mockRejectedValue(new Error('unavailable'));

    const view = await renderHook(() => useScreenReader());
    await act(async () => {});
    expect(view.result.current).toBe(true);
  });
});
