import { AppState } from 'react-native';
import { create } from 'zustand';

/**
 * BUG-045: "today" follows the device's local calendar day while the app
 * stays open. The day is checked when the app returns to the foreground and
 * at the next local midnight; a new day updates `useLocalDay` (so anything
 * that renders the date re-renders) and tells the registered listeners, which
 * reload the day-bound data.
 */

/** YYYY-MM-DD of a moment on the device's local calendar. */
export function localDayOf(moment: Date): string {
  const y = moment.getFullYear();
  const m = String(moment.getMonth() + 1).padStart(2, '0');
  const d = String(moment.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface LocalDayState {
  today: string;
}

export const useLocalDay = create<LocalDayState>(() => ({ today: localDayOf(new Date()) }));

type DayListener = (today: string) => void;
const listeners = new Set<DayListener>();

export function onLocalDayChange(listener: DayListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Moves "today" forward when the local day changed. Returns whether it did. */
export function checkLocalDay(now: Date = new Date()): boolean {
  const today = localDayOf(now);
  if (today === useLocalDay.getState().today) return false;
  useLocalDay.setState({ today });
  for (const listener of listeners) listener(today);
  return true;
}

/** Milliseconds from `now` to one second past the next local midnight. */
export function msToNextLocalDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

let stop: (() => void) | null = null;

/** Starts watching once (composition root); returns the stop function. */
export function startLocalDayWatch(): () => void {
  if (stop) return stop;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      checkLocalDay();
      schedule();
    }, msToNextLocalDay(new Date()));
  };
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    checkLocalDay();
    // Timers do not run while suspended; re-arm against the current clock.
    schedule();
  });
  schedule();
  stop = () => {
    if (timer) clearTimeout(timer);
    subscription.remove();
    stop = null;
  };
  return stop;
}
