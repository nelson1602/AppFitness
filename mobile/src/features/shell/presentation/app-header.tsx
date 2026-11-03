import { useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/features/authentication';
import { useHomeData } from '@/features/dashboard/application/use-home-data';
import { unreadOf } from '@/features/notifications';
import { useNotificationsStore } from '@/features/notifications/application/notifications.store';
import { useLocalDay } from '@/shared/application/local-day';
import { formatDate, formatNumber, interpolate, useLocalization } from '@/shared/localization';
import { AppText, backgroundImageStyle, ctaBackgroundImage, Icon } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { NotificationList } from './notification-list';
import { tabOf } from './tab-config';

/** From this text scale the title gets its own line (v8 Block 5 copy pass). */
export const HEADER_STACK_FONT_SCALE = 1.5;

/**
 * The design's header (ADR-P039), transparent over the shell's glow (v8.1 round 2): today's date, then "Hola, {name}" on Inicio
 * or the tab's name elsewhere, and the notification bell. The bell is native
 * only — on Web the notification state lives in the dormant local database
 * (ADR-P019), so there is nothing truthful to count.
 */
export function AppHeader({ routeName }: { routeName: string }) {
  const { colors, radius, spacing } = useTheme();
  const { language, t } = useLocalization();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { session } = useSession();
  const tab = tabOf(routeName);
  const title =
    routeName === 'dashboard' && session
      ? interpolate(t('header.greeting'), { name: session.user.username })
      : tab
        ? t(tab.labelKey)
        : '';
  // BUG-045: follows the local day while the app stays open.
  const today = useLocalDay((s) => s.today);
  const date = formatDate(new Date(`${today}T12:00:00`), language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  // At large text a tab name no longer fits between the avatar and the bell and
  // would break mid-word; the date and title then take a full-width line.
  const stacked = fontScale >= HEADER_STACK_FONT_SCALE;
  const bell = Platform.OS === 'web' ? null : <NotificationBell radius={radius.full} />;

  return (
    <View
      style={[
        styles.row,
        stacked ? styles.wrap : null,
        {
          gap: spacing.md,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.md,
        },
      ]}
      testID="app-header"
    >
      {session ? (
        // The design's avatar: the account's initials, decorative (the
        // greeting beside it names the person).
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.avatar,
            backgroundImageStyle(ctaBackgroundImage(colors), colors.ctaStart),
            {
              borderColor: colors.glassBorder,
              borderRadius: radius.full,
              height: spacing.x5l - spacing.xs,
              width: spacing.x5l - spacing.xs,
            },
          ]}
          testID="header-avatar"
        >
          <AppText style={{ color: colors.onCta }} variant="label">
            {session.user.username.slice(0, 2).toUpperCase()}
          </AppText>
        </View>
      ) : null}
      {stacked ? (
        <>
          <View style={styles.grow} />
          {bell}
        </>
      ) : null}
      <View
        style={[stacked ? styles.fullWidth : styles.grow, { gap: spacing.xs }]}
        testID="header-titles"
      >
        <AppText tone="onStageVariant" variant="caption">
          {date}
        </AppText>
        <AppText accessibilityRole="header" numberOfLines={2} tone="onStage" variant="title">
          {title}
        </AppText>
      </View>
      {stacked ? null : bell}
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
  avatar: {
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
  },
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
  fullWidth: {
    flexBasis: '100%',
  },
  grow: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
