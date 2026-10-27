import { AppState } from 'react-native';

import {
  checkLocalDay,
  localDayOf,
  msToNextLocalDay,
  onLocalDayChange,
  startLocalDayWatch,
  useLocalDay,
} from './local-day';

/** BUG-045: "today" must follow the local day while the app stays open. */
describe('local day', () => {
  let changeHandler: ((state: string) => void) | null = null;
  const remove = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    changeHandler = null;
    remove.mockClear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      changeHandler = handler as (state: string) => void;
      return { remove } as never;
    });
    useLocalDay.setState({ today: '2026-10-19' });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('uses the local calendar day, not the UTC date', () => {
    // 22:30 local on the 19th is already the 20th in UTC west of Greenwich.
    expect(localDayOf(new Date(2026, 9, 19, 22, 30))).toBe('2026-10-19');
    expect(localDayOf(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });

  it('moves today forward and tells the listeners only when the day changed', () => {
    const listener = jest.fn();
    const off = onLocalDayChange(listener);

    expect(checkLocalDay(new Date(2026, 9, 19, 23, 59))).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    expect(checkLocalDay(new Date(2026, 9, 21, 10, 0))).toBe(true);
    expect(useLocalDay.getState().today).toBe('2026-10-21');
    expect(listener).toHaveBeenCalledWith('2026-10-21');
    off();
  });

  it('times the check for just past the next local midnight', () => {
    expect(msToNextLocalDay(new Date(2026, 9, 19, 23, 59, 0))).toBe(61_000);
  });

  it('checks the day when the app returns to the foreground and at midnight', () => {
    jest.setSystemTime(new Date(2026, 9, 19, 23, 59, 30));
    const listener = jest.fn();
    const off = onLocalDayChange(listener);
    const stop = startLocalDayWatch();

    // The app was left open past midnight.
    jest.advanceTimersByTime(31_000);
    expect(listener).toHaveBeenLastCalledWith('2026-10-20');

    // Resumed two days later: the foreground event catches it.
    jest.setSystemTime(new Date(2026, 9, 22, 9, 0));
    changeHandler?.('background');
    expect(listener).toHaveBeenCalledTimes(1);
    changeHandler?.('active');
    expect(listener).toHaveBeenLastCalledWith('2026-10-22');

    stop();
    expect(remove).toHaveBeenCalled();
    off();
  });
});
