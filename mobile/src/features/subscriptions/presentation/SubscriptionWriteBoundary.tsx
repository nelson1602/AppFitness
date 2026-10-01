import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useEntitlementAccess } from '@/shared/application/use-entitlement-access';
import { PaidWriteDisabledProvider } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { SubscriptionAccessNotice } from './SubscriptionAccessNotice';

/** Keeps saved content visible while disabling the write controls beneath it. */
export function SubscriptionWriteBoundary({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { mode } = useEntitlementAccess();
  const disabled = mode === 'checking' || mode === 'read-only';

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {disabled ? <SubscriptionAccessNotice /> : null}
      <PaidWriteDisabledProvider disabled={disabled}>{children}</PaidWriteDisabledProvider>
    </View>
  );
}
