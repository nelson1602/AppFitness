import { useEffect, useRef, useState, type Ref } from 'react';
import {
  type AccessibilityActionEvent,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { formatDate, formatNumber } from '../localization/format';
import type { TranslationKey } from '../localization/resources/en';
import { useLocalization } from '../localization/use-localization';
import { useTheme } from '../theme';
import { AppText } from './app-text';
import { columnValues, partOf, setPart, stepPart, type WheelPart } from './date-wheel.model';
import { useReducedMotion } from './use-reduced-motion';

export interface DateWheelPickerProps {
  /** The selected `YYYY-MM-DD`, already inside the range. */
  value: string;
  onChange: (next: string) => void;
  /** Inclusive `YYYY-MM-DD` bounds. */
  minimumDate: string;
  maximumDate: string;
  testID: string;
  /** The year column, so a sheet can move screen-reader focus to it. */
  yearRef?: Ref<View>;
}

interface WheelItem {
  value: number;
  label: string;
}

// The part of a react-native-web keydown event the column reads.
type WebKeyEvent = { key: string; preventDefault: () => void };

const isWeb = Platform.OS === 'web';

const COLUMN_LABEL: Record<WheelPart, TranslationKey> = {
  day: 'form.dateWheel.day',
  month: 'form.dateWheel.month',
  year: 'form.dateWheel.year',
};

/**
 * Birth-date wheel (owner decision 2026-11-02, v8.1; ADR-P043 amendment):
 * three snapping `FlatList` columns — Día, Mes, Año — with a band marking the
 * centre row. No native module, so it renders the same on iOS, Android and
 * Web.
 *
 * Accessibility: each column is one `adjustable` element (TalkBack and
 * VoiceOver swipe up/down, or the volume keys, step it one item; Web uses the
 * arrow keys) whose value is the localized day, month name or year. The rows
 * are hidden from assistive technology. Focus starts on the YEAR column:
 * the columns render in the order Año, Mes, Día — the order TalkBack and the
 * browser (DOM and Tab order) follow — and `row-reverse` lays them out as
 * Día / Mes / Año. VoiceOver may order siblings by position instead, so the
 * sheet that hosts the wheel also moves focus to `yearRef` when it opens.
 * (RN's `experimental_accessibilityOrder` would state the order outright, but
 * it sits behind a native feature flag that is off by default in RN 0.86.)
 */
export function DateWheelPicker({
  value,
  onChange,
  minimumDate,
  maximumDate,
  testID,
  yearRef,
}: DateWheelPickerProps) {
  const theme = useTheme();
  const { language, t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();

  // Rows grow with the OS text size and never drop under the 48 dp target;
  // at large text the wheel shows three rows instead of five.
  const itemHeight = Math.max(
    theme.spacing.x5l,
    Math.ceil(theme.typography.title.lineHeight * fontScale) + theme.spacing.md,
  );
  const visibleRows = fontScale > 1.3 ? 3 : 5;

  const values = columnValues(value, minimumDate, maximumDate);
  const label = (part: WheelPart, item: number) =>
    part === 'month'
      ? formatDate(new Date(2000, item - 1, 1), language, { month: 'long' })
      : formatNumber(item, language, { useGrouping: false });
  const items = (part: WheelPart): WheelItem[] =>
    values[part].map((item) => ({ value: item, label: label(part, item) }));

  const column = (part: WheelPart, flex: number, ref?: Ref<View>) => (
    <WheelColumn
      animated={!reduceMotion}
      flex={flex}
      itemHeight={itemHeight}
      items={items(part)}
      label={t(COLUMN_LABEL[part])}
      onSelect={(next) => onChange(setPart(value, part, next, minimumDate, maximumDate))}
      onStep={(delta) => onChange(stepPart(value, part, delta, minimumDate, maximumDate))}
      ref={ref}
      selected={partOf(value, part)}
      testID={`${testID}-${part}`}
      visibleRows={visibleRows}
    />
  );

  return (
    <View
      style={[styles.columns, { gap: theme.spacing.sm, height: itemHeight * visibleRows }]}
      testID={testID}
    >
      <View
        pointerEvents="none"
        style={[
          styles.band,
          {
            backgroundColor: theme.colors.glassFill,
            borderColor: theme.colors.accentCyan,
            borderRadius: theme.radius.field,
            height: itemHeight,
            top: itemHeight * Math.floor(visibleRows / 2),
          },
        ]}
        testID={`${testID}-band`}
      />
      {/* Year first in the tree (focus order), last on screen (row-reverse). */}
      {column('year', 3, yearRef)}
      {column('month', 4)}
      {column('day', 2)}
    </View>
  );
}

interface WheelColumnProps {
  items: WheelItem[];
  selected: number;
  onSelect: (value: number) => void;
  onStep: (delta: 1 | -1) => void;
  label: string;
  itemHeight: number;
  visibleRows: number;
  animated: boolean;
  flex: number;
  testID: string;
  ref?: Ref<View>;
}

function WheelColumn({
  items,
  selected,
  onSelect,
  onStep,
  label,
  itemHeight,
  visibleRows,
  animated,
  flex,
  testID,
  ref,
}: WheelColumnProps) {
  const theme = useTheme();
  const listRef = useRef<FlatList<WheelItem>>(null);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === selected),
  );
  // The row the list rests on; the list scrolls only when the value moves
  // away from it (an accessibility step, a tap, or a clamp).
  const restingIndex = useRef(selectedIndex);
  // Where the list opens, without animation; later moves use scrollToOffset.
  const [initialOffset] = useState(selectedIndex * itemHeight);
  const webSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const padding = itemHeight * Math.floor(visibleRows / 2);

  useEffect(() => {
    if (restingIndex.current === selectedIndex) return;
    restingIndex.current = selectedIndex;
    listRef.current?.scrollToOffset({ offset: selectedIndex * itemHeight, animated });
  }, [selectedIndex, itemHeight, animated]);

  useEffect(
    () => () => {
      if (webSettle.current) clearTimeout(webSettle.current);
    },
    [],
  );

  const settle = (offsetY: number) => {
    const index = Math.min(items.length - 1, Math.max(0, Math.round(offsetY / itemHeight)));
    restingIndex.current = index;
    if (items[index].value !== selected) onSelect(items[index].value);
    else if (Math.abs(offsetY - index * itemHeight) > 1) {
      listRef.current?.scrollToOffset({ offset: index * itemHeight, animated });
    }
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    settle(event.nativeEvent.contentOffset.y);

  // A drag that stops without a fling sends no momentum event.
  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!event.nativeEvent.velocity?.y) settle(event.nativeEvent.contentOffset.y);
  };

  // The browser sends no scroll-end event: settle once scrolling pauses.
  const onWebScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (webSettle.current) clearTimeout(webSettle.current);
    webSettle.current = setTimeout(() => settle(offsetY), 150);
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') onStep(1);
    if (event.nativeEvent.actionName === 'decrement') onStep(-1);
  };

  const onKeyDown = (event: WebKeyEvent) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      onStep(1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      onStep(-1);
    }
  };

  return (
    <View
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      accessibilityLabel={label}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: items[selectedIndex]?.label ?? '' }}
      accessible
      focusable
      onAccessibilityAction={onAccessibilityAction}
      ref={ref}
      style={{ flex }}
      testID={testID}
      {...(isWeb ? { onKeyDown } : null)}
    >
      <FlatList
        accessibilityElementsHidden
        contentOffset={{ x: 0, y: initialOffset }}
        data={items}
        extraData={selectedIndex}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          index,
          length: itemHeight,
          offset: padding + index * itemHeight,
        })}
        importantForAccessibility="no-hide-descendants"
        initialNumToRender={items.length}
        keyExtractor={(item) => String(item.value)}
        ListFooterComponent={<View style={{ height: padding }} />}
        ListHeaderComponent={<View style={{ height: padding }} />}
        onMomentumScrollEnd={onScrollEnd}
        onScroll={isWeb ? onWebScroll : undefined}
        onScrollEndDrag={onScrollEndDrag}
        ref={listRef}
        testID={`${testID}-list`}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => {
              if (item.value !== selected) onSelect(item.value);
            }}
            style={{
              alignItems: 'center',
              height: itemHeight,
              justifyContent: 'center',
              minHeight: theme.spacing.x5l,
              paddingHorizontal: theme.spacing.xs,
            }}
            testID={`${testID}-${item.value}`}
          >
            <AppText
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              numberOfLines={1}
              tone={index === selectedIndex ? 'onStage' : 'onStageVariant'}
              variant={index === selectedIndex ? 'title' : 'body'}
            >
              {item.label}
            </AppText>
          </Pressable>
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        windowSize={items.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    borderWidth: 1.5,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  columns: {
    flexDirection: 'row-reverse',
  },
});
