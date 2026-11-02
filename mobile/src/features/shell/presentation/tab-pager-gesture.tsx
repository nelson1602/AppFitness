import { createContext, type PropsWithChildren, useContext } from 'react';
import type { NativeSyntheticEvent, NativeTouchEvent } from 'react-native';

type TouchHandler = (event: NativeSyntheticEvent<NativeTouchEvent>) => void;

interface TabPagerGestureValue {
  onTouchCancel?: TouchHandler;
  onTouchEnd?: TouchHandler;
  onTouchStart?: TouchHandler;
}

const TabPagerGestureContext = createContext<TabPagerGestureValue>({});

export function TabPagerGestureProvider({
  children,
  onInnerSwipeChange,
}: PropsWithChildren<{ onInnerSwipeChange: (active: boolean) => void }>) {
  return (
    <TabPagerGestureContext.Provider
      value={{
        onTouchCancel: () => onInnerSwipeChange(false),
        onTouchEnd: () => onInnerSwipeChange(false),
        onTouchStart: () => onInnerSwipeChange(true),
      }}
    >
      {children}
    </TabPagerGestureContext.Provider>
  );
}

/** Keeps a horizontal child scroller in control of the gesture it started. */
export function useTabPagerSwipeExclusion(): TabPagerGestureValue {
  return useContext(TabPagerGestureContext);
}
