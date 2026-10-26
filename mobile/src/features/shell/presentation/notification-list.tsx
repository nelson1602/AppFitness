import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import type {
  AppNotification,
  NotificationKind,
  NotificationTarget,
} from '@/features/notifications';
import {
  formatNumber,
  interpolate,
  type SupportedLanguage,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import {
  AppButton,
  AppText,
  backgroundImageStyle,
  ctaBackgroundImage,
  Icon,
  type IconName,
  useReducedMotion,
  withAlpha,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

const COPY: Record<NotificationKind, { title: TranslationKey; body: TranslationKey }> = {
  'today-training': {
    title: 'notifications.todayTraining.title',
    body: 'notifications.todayTraining.body',
  },
  'today-rest': { title: 'notifications.todayRest.title', body: 'notifications.todayRest.body' },
  'weigh-in': { title: 'notifications.weighIn.title', body: 'notifications.weighIn.body' },
  'evaluation-review': {
    title: 'notifications.evaluationReview.title',
    body: 'notifications.evaluationReview.body',
  },
};

/** The design's icon for each kind (dumbbell, scale, clipboard). */
const ICON: Record<NotificationKind, IconName> = {
  'today-training': 'dumbbell',
  'today-rest': 'dumbbell',
  'weigh-in': 'scale',
  'evaluation-review': 'clipboard',
};

/** "Hoy", "Ayer", "Hace 3 días" — or nothing when there was no such event. */
export function notificationTime(
  ageDays: number | null,
  t: (key: TranslationKey) => string,
  language: SupportedLanguage,
): string | null {
  if (ageDays === null) return null;
  if (ageDays <= 0) return t('notifications.time.today');
  if (ageDays === 1) return t('notifications.time.yesterday');
  return interpolate(t('notifications.time.daysAgo'), { count: formatNumber(ageDays, language) });
}

const ROUTE: Record<NotificationTarget, '/workouts' | '/progress' | '/profile'> = {
  workouts: '/workouts',
  progress: '/progress',
  profile: '/profile',
};

interface NotificationListProps {
  items: readonly AppNotification[];
  readIds: readonly string[];
  onClose: () => void;
  onMarkRead: (ids: readonly string[]) => void;
}

/**
 * The bell's list (ADR-P039 D4): each item opens its tab and becomes read;
 * "Marcar todo como leído" appears only while something is unread. Unread is
 * shown by weight, a dot and a spoken "Unread" — never colour alone.
 */
export function NotificationList({ items, readIds, onClose, onMarkRead }: NotificationListProps) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { language, t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const unread = items.filter((item) => !readIds.includes(item.id));

  const open = (item: AppNotification) => {
    onMarkRead([item.id]);
    onClose();
    router.navigate(ROUTE[item.target]);
  };

  return (
    <Modal
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      {/* The scrim is not a control: Close and the system back gesture
          (onRequestClose) dismiss, so nothing closes by a stray tap. */}
      <View style={[styles.scrim, { backgroundColor: withAlpha(colors.stage, 0.75) }]}>
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.stageDeep,
            borderColor: colors.glassBorder,
            borderRadius: radius.sheet,
            borderWidth: 1,
            gap: spacing.md,
            margin: spacing.lg,
            marginTop: spacing.x6l,
            padding: spacing.lg,
          }}
          testID="notifications-list"
        >
          <View style={[styles.row, { gap: spacing.sm }]}>
            <AppText accessibilityRole="header" style={styles.grow} tone="onStage" variant="title">
              {t('notifications.title')}
            </AppText>
            <Pressable
              accessibilityLabel={t('notifications.close')}
              accessibilityRole="button"
              onPress={onClose}
              style={[
                styles.center,
                {
                  backgroundColor: colors.glassFill,
                  borderRadius: radius.full,
                  minHeight: theme.spacing.x5l,
                  minWidth: theme.spacing.x5l,
                },
              ]}
              testID="notifications-close"
            >
              <Icon color={colors.onStage} name="x" size={20} />
            </Pressable>
          </View>
          {unread.length > 0 ? (
            <AppButton
              onPress={() => onMarkRead(unread.map((item) => item.id))}
              testID="notifications-mark-all"
              variant="stage-link"
            >
              {t('notifications.markAllRead')}
            </AppButton>
          ) : null}
          {items.length === 0 ? (
            <AppText tone="onStageVariant">{t('notifications.empty')}</AppText>
          ) : (
            items.map((item) => {
              const isUnread = !readIds.includes(item.id);
              const copy = COPY[item.kind];
              const time = notificationTime(item.ageDays, t, language);
              return (
                <Pressable
                  accessibilityHint={isUnread ? t('notifications.unread') : undefined}
                  accessibilityLabel={[t(copy.title), time, t(copy.body)]
                    .filter(Boolean)
                    .join('. ')}
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => open(item)}
                  style={[
                    styles.top,
                    {
                      backgroundColor: isUnread ? colors.glassFill : 'transparent',
                      borderRadius: radius.field,
                      gap: spacing.md,
                      minHeight: theme.spacing.x5l,
                      padding: spacing.md,
                    },
                  ]}
                  testID={`notification-${item.kind}`}
                >
                  <View
                    style={[
                      styles.center,
                      isUnread
                        ? backgroundImageStyle(ctaBackgroundImage(colors), colors.ctaStart)
                        : { backgroundColor: colors.glassFill },
                      { borderRadius: radius.full, height: spacing.x4l, width: spacing.x4l },
                    ]}
                  >
                    <Icon
                      color={isUnread ? colors.onCta : colors.onStage}
                      name={ICON[item.kind]}
                      size={18}
                    />
                  </View>
                  <View style={[styles.grow, { gap: spacing.xs }]}>
                    <View style={[styles.row, { gap: spacing.sm }]}>
                      <AppText
                        style={styles.grow}
                        tone={isUnread ? 'onStage' : 'onStageVariant'}
                        variant="label"
                      >
                        {t(copy.title)}
                      </AppText>
                      {time ? (
                        <AppText
                          testID={`notification-${item.kind}-time`}
                          tone="onStageVariant"
                          variant="caption"
                        >
                          {time}
                        </AppText>
                      ) : null}
                    </View>
                    <AppText tone="onStageVariant" variant="caption">
                      {t(copy.body)}
                    </AppText>
                  </View>
                  {isUnread ? (
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={{
                        backgroundColor: colors.accentEnergy,
                        borderRadius: radius.full,
                        height: spacing.sm,
                        width: spacing.sm,
                      }}
                      testID={`notification-${item.kind}-unread`}
                    />
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  scrim: {
    flex: 1,
  },
  top: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
});
