import type { BottomTabHeaderProps } from 'expo-router/tabs';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/features/authentication';
import { useHomeData } from '@/features/dashboard/application/use-home-data';
import { unreadOf } from '@/features/notifications';
import { useNotificationsStore } from '@/features/notifications/application/notifications.store';
import { formatDate, formatNumber, interpolate, useLocalization } from '@/shared/localization';
import { AppText, Icon } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { NotificationList } from './notification-list';
import { tabOf } from './tab-config';

/**
 * The design's header (ADR-P039): today's date, then "Hola, {name}" on Inicio
 * or the tab's name elsewhere, and the notification bell. The bell is native
 * only — on Web the notification state lives in the dormant local database
 * (ADR-P019), so there is nothing truthful to count.
 */
export function AppHeader({ route }: BottomTabHeaderProps) {
  const { colors, radius, spacing } = useTheme();
  const { language, t } = useLocalization();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const tab = tabOf(route.name);
  const title =
    route.name === 'dashboard' && session
      ? interpolate(t('header.greeting'), { name: session.user.username })
      : tab
        ? t(tab.labelKey)
        : '';
  const date = formatDate(new Date(), language, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.stageTop,
          gap: spacing.md,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.md,
        },
      ]}
      testID="app-header"
    >
      <View style={[styles.grow, { gap: spacing.xs }]}>
        <AppText tone="onStageVariant" variant="caption">
          {date}
        </AppText>
        <AppText accessibilityRole="header" tone="onStage" variant="headline">
          {title}
        </AppText>
      </View>
      {Platform.OS === 'web' ? null : <NotificationBell radius={radius.full} />}
    </View>
  );
}

function NotificationBell({ radius }: { radius: number }) {
  const theme = useTheme();
  const { colors, spacing, typography } = theme;
  const { language, t } = useLocalization();
  const [open, setOpen] = useState(false);
  const { notifications } = useHomeData();
  const readIds = useNotificationsStore((s) => s.readIds);
  const markRead = useNotificationsStore((s) => s.markRead);
  const count = unreadOf(notifications, new Set(readIds)).length;

  return (
    <>
      <Pressable
        accessibilityLabel={interpolate(t('header.notifications'), {
          count: formatNumber(count, language),
        })}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[
          styles.bell,
          {
            backgroundColor: colors.glassFill,
            borderColor: colors.glassBorder,
            borderRadius: radius,
            minHeight: theme.spacing.x5l,
            minWidth: theme.spacing.x5l,
          },
        ]}
        testID="header-bell"
      >
        <Icon color={colors.onStage} name="bell" size={22} />
        {count > 0 ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.badge,
              {
                backgroundColor: colors.ctaStart,
                borderRadius: radius,
                minWidth: spacing.lg,
                paddingHorizontal: spacing.xs,
              },
            ]}
            testID="header-bell-badge"
          >
            <AppText style={[typography.caption, { color: colors.onCta }]} variant="caption">
              {formatNumber(count, language)}
            </AppText>
          </View>
        ) : null}
      </Pressable>
      {open ? (
        <NotificationList
          items={notifications}
          onClose={() => setOpen(false)}
          onMarkRead={(ids) => {
            void markRead(ids);
          }}
          readIds={readIds}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bell: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
