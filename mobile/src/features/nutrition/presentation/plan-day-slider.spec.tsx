import { fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';

import { lightTheme } from '@/shared/theme';

import { dayAt, PlanDaySlider, thumbOffset } from './plan-day-slider';

let mockLanguage: 'en' | 'es' = 'en';
let mockReduceMotion = false;

jest.mock('@/shared/presentation', () => ({
  ...jest.requireActual('@/shared/presentation'),
  useReducedMotion: () => mockReduceMotion,
}));
jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

const THUMB = 22;
/** A 222 dp row: the thumb's centre travels 200 dp, 1/14 of it per day. */
const WIDTH = 222;

async function renderSlider(selected = 3, onSelect = jest.fn()) {
  const view = await render(<PlanDaySlider count={15} onSelect={onSelect} selected={selected} />);
  await fireEvent(screen.getByTestId('plan-day-slider'), 'layout', {
    nativeEvent: { layout: { width: WIDTH, height: 44, x: 0, y: 0 } },
  });
  return { onSelect, ...view };
}

/** A touch on the row `x` dp from its left edge, the row starting at page x 16. */
const touchAt = (x: number, y = 0) => ({
  nativeEvent: { locationX: x, pageX: 16 + x, pageY: 500 + y, touches: [], changedTouches: [] },
  touchHistory: { touchBank: [] },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockReduceMotion = false;
});

describe('day geometry (pure)', () => {
  it('maps the track to days 1…15, clamped at both ends', () => {
    expect(dayAt(0, 200, 15)).toBe(1);
    expect(dayAt(200, 200, 15)).toBe(15);
    expect(dayAt(100, 200, 15)).toBe(8);
    expect(dayAt(-40, 200, 15)).toBe(1);
    expect(dayAt(900, 200, 15)).toBe(15);
    expect(dayAt(50, 0, 15)).toBe(1);
  });

  it('places the thumb so each day sits where dayAt reads it', () => {
    for (let day = 1; day <= 15; day += 1) {
      expect(dayAt(thumbOffset(day, 200, 15), 200, 15)).toBe(day);
    }
    expect(thumbOffset(1, 200, 15)).toBe(0);
    expect(thumbOffset(15, 200, 15)).toBe(200);
  });
});

describe('PlanDaySlider', () => {
  it('is an adjustable control named for the plan, valued as "Day N of 15"', async () => {
    await renderSlider(3);
    const slider = screen.getByTestId('plan-day-slider');
    expect(slider.props.accessibilityRole).toBe('adjustable');
    expect(slider.props.accessibilityLabel).toBe('15-day plan');
    expect(slider.props.accessibilityHint).toBe('Drag to choose the plan day');
    expect(slider.props.accessibilityValue).toEqual({
      min: 1,
      max: 15,
      now: 3,
      text: 'Day 3 of 15',
    });
    expect(slider.props.accessibilityActions).toEqual([
      { name: 'increment' },
      { name: 'decrement' },
    ]);
  });

  it('speaks Spanish in Spanish', async () => {
    mockLanguage = 'es';
    await renderSlider(7);
    const slider = screen.getByTestId('plan-day-slider');
    expect(slider.props.accessibilityLabel).toBe('Plan de 15 días');
    expect(slider.props.accessibilityValue.text).toBe('Día 7 de 15');
  });

  it('moves one day per screen-reader increment or decrement, never past the ends', async () => {
    const { onSelect, rerender } = await renderSlider(3);
    const slider = () => screen.getByTestId('plan-day-slider');
    await fireEvent(slider(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onSelect).toHaveBeenLastCalledWith(4);
    await fireEvent(slider(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onSelect).toHaveBeenLastCalledWith(2);

    onSelect.mockClear();
    await rerender(<PlanDaySlider count={15} onSelect={onSelect} selected={15} />);
    await fireEvent(slider(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await rerender(<PlanDaySlider count={15} onSelect={onSelect} selected={1} />);
    await fireEvent(slider(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  // Day 3 of 15 on a 200 dp travel: thumb centre at 11 + 200 · 2/14.
  const THUMB_CENTRE_DAY3 = THUMB / 2 + (200 * 2) / 14;

  it('follows a drag that starts on the thumb and keeps it from the tab pager', async () => {
    const { onSelect } = await renderSlider(3);
    const slider = screen.getByTestId('plan-day-slider');
    expect(slider.props.onStartShouldSetResponder()).toBe(true);

    expect(slider.props.onResponderGrant(touchAt(THUMB_CENTRE_DAY3))).toBe(true);
    expect(slider.props.onResponderTerminationRequest()).toBe(false);
    slider.props.onResponderMove(touchAt(THUMB / 2 + 200));
    expect(onSelect).toHaveBeenLastCalledWith(15);
    // Within the same day nothing new is reported.
    slider.props.onResponderMove(touchAt(THUMB / 2 + 199));
    expect(onSelect).toHaveBeenCalledTimes(1);
    slider.props.onResponderMove(touchAt(-30));
    expect(onSelect).toHaveBeenLastCalledWith(1);
    slider.props.onResponderRelease(touchAt(-30));
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('jumps to the day under a tap on the track, on release', async () => {
    const { onSelect } = await renderSlider(3);
    const slider = screen.getByTestId('plan-day-slider');
    // Day 8 is the middle: centre at 11 + 100. Off the thumb, so not claimed.
    expect(slider.props.onResponderGrant(touchAt(THUMB / 2 + 100))).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
    slider.props.onResponderRelease(touchAt(THUMB / 2 + 100));
    expect(onSelect).toHaveBeenCalledWith(8);
  });

  // v8.1 round 2 device check: a vertical swipe over the track moved the plan
  // to day 8 and the page would not scroll.
  it('lets a vertical scroll over the track go without changing the day', async () => {
    const { onSelect } = await renderSlider(3);
    const slider = screen.getByTestId('plan-day-slider');
    slider.props.onResponderGrant(touchAt(THUMB / 2 + 100));
    slider.props.onResponderMove(touchAt(THUMB / 2 + 100, 60));
    expect(slider.props.onResponderTerminationRequest()).toBe(true);
    slider.props.onResponderRelease(touchAt(THUMB / 2 + 100, 60));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the whole row at least the 44 dp touch floor', async () => {
    await renderSlider();
    const style = StyleSheet.flatten(screen.getByTestId('plan-day-slider').props.style);
    expect(style.minHeight).toBe(lightTheme.spacing.x5l);
    expect(lightTheme.spacing.x5l).toBeGreaterThanOrEqual(44);
  });

  it('glides the thumb to a new day, and jumps without animation under reduced motion', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const { onSelect, rerender } = await renderSlider(3);
    await rerender(<PlanDaySlider count={15} onSelect={onSelect} selected={9} />);
    expect(timing).toHaveBeenCalled();

    timing.mockClear();
    mockReduceMotion = true;
    await rerender(<PlanDaySlider count={15} onSelect={onSelect} selected={12} />);
    expect(timing).not.toHaveBeenCalled();
    timing.mockRestore();
  });
});
