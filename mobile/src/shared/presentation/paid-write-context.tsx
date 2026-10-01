import { createContext, type ReactNode, useContext } from 'react';

const PaidWriteDisabledContext = createContext(false);

export function PaidWriteDisabledProvider({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled: boolean;
}) {
  return (
    <PaidWriteDisabledContext.Provider value={disabled}>
      {children}
    </PaidWriteDisabledContext.Provider>
  );
}

export function usePaidWriteDisabled(): boolean {
  return useContext(PaidWriteDisabledContext);
}
