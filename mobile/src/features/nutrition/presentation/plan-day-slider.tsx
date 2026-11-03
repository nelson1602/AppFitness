import { useEffect, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  Animated,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';

import { formatNumber, interpolate, useLocalization } from '@/shared/localization';
import { useReducedMotion, withAlpha } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * The 15-day plan slider (v8.1 round 2, docs/design prototype Nutrición: the
 * `day-range` input under "Plan de 15 días · Día N de 15"). A thin cyan track
 * with a round thumb; dragging or tapping picks a day, a screen reader adjusts
 * it one day at a time. The whole row is the touch target (at least the 44 dp
 * floor), and it claims the touch from the start so the tab pager's swipe
 * does not take a drag along the track. Under reduced motion the thumb moves
 * without animation.
 */

const THUMB_SIZE = 22;
const TRACK_HEIGHT = 4;
const SETTLE_MS = 160;

/** The day (1…count) under `x` on a track whose thumb centre travels `travel` (pure). */
export function dayAt(x: number, travel: number, count: number): number {
  if (count <= 1 || travel <= 0) return 1;
  const ratio = Math.min(1, Math.max(0, x / travel));
  return Math.round(ratio * (count - 1)) + 1;
}

/** Where the thumb's left edge sits for `day` (pure). */
export function thumbOffset(day: number, travel: number, count: number): number {
  return count > 1 ? ((Math.min(count, Math.max(1, day)) - 1) / (count - 1)) * travel : 0;
}

export function PlanDaySlider({
  count,
  selected,
  onSelect,
}: {
  count: number;
  selected: number;
  onSelect: (day: number) => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const { language, t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const [travel, setTravel] = useState(0);
  const [offset] = useState(() => new Animated.Value(0));
  // Touch state lives in refs, read and written only by the touch handlers.
  const drag = useRef({ active: false, originX: 0, day: selected });

  useEffect(() => {
    const to = thumbOffset(selected, travel, count);
    if (reduceMotion || drag.current.active || travel === 0) {
      offset.setValue(to);
      return;
    }
    const settle = Animated.timing(offset, {
      toValue: to,
      duration: SETTLE_MS,
      useNativeDriver: false,
    });
    settle.start();
    return () => settle.stop();
  }, [count, offset, reduceMotion, selected, travel]);

  const pick = (pageX: number) => {
    const day = dayAt(pageX - drag.current.originX - THUMB_SIZE / 2, travel, count);
    if (day === drag.current.day) return;
    drag.current.day = day;
    onSelect(day);
  };

  // The row claims the touch on contact and keeps it, and returning true from
  // the grant blocks the native responder, so the tab pager cannot take the drag.
  const touch = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (event: GestureResponderEvent) => {
      const { locationX, pageX } = event.nativeEvent;
      drag.current = { active: true, originX: pageX - locationX, day: selected };
      pick(pageX);
      return true;
    },
    onResponderMove: (event: GestureResponderEvent) => pick(event.nativeEvent.pageX),
    onResponderRelease: () => {
      drag.current.active = false;
    },
    onResponderTerminate: () => {
      drag.current.active = false;
    },
  };

  const onLayout = (event: LayoutChangeEvent) =>
    setTravel(Math.max(0, event.nativeEvent.layout.width - THUMB_SIZE));

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
    const day = Math.min(count, Math.max(1, selected + step));
    if (day !== selected) onSelect(day);
  };

  const valueText = interpolate(t('nutrition.plan.dayOf'), {
    day: formatNumber(selected, language),
    count: formatNumber(count, language),
  });

  return (
    <View
      accessible
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      accessibilityHint={t('nutrition.plan.sliderHint')}
      accessibilityLabel={t('nutrition.plan.stripLabel')}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 1, max: count, now: selected, text: valueText }}
      onAccessibilityAction={onAccessibilityAction}
      onLayout={onLayout}
      style={{ justifyContent: 'center', minHeight: theme.spacing.x5l }}
      testID="plan-day-slider"
      {...touch}
    >
      {/* Touches land on the row itself, so locationX is along the track. */}
      <View pointerEvents="none" style={styles.rail}>
        <View
          style={[
            styles.track,
            {
              backgroundColor: withAlpha(colors.onStage, 0.15),
              left: THUMB_SIZE / 2,
              right: THUMB_SIZE / 2,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.track,
            {
              backgroundColor: colors.accentCyan,
              left: THUMB_SIZE / 2,
              width: offset,
            },
          ]}
          testID="plan-day-slider-fill"
        />
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: colors.accentCyan,
              borderColor: colors.linkOnStage,
              transform: [{ translateX: offset }],
            },
          ]}
          testID="plan-day-slider-thumb"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { height: THUMB_SIZE, justifyContent: 'center' },
  thumb: {
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    height: THUMB_SIZE,
    left: 0,
    position: 'absolute',
    width: THUMB_SIZE,
  },
  track: {
    borderRadius: TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
    position: 'absolute',
  },
});
