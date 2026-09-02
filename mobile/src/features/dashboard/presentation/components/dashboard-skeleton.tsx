import { View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * This is not only the dashboard's loading treatment — it is the
 * session-resolution loader for 12 routes, so its accessible label is exposed on
 * essentially every authenticated entry into the app. It must therefore come
 * from the catalogue like every other user-facing string (BUG-010,
 * `.ai/06_MOBILE.md` §Internationalization); a hardcoded English literal reached
 * assistive technology on a Spanish-locale device.
 *
 * The visual output and the empty props API are unchanged. Whether, when, or how
 * a screen reader announces this label is **not** claimed here — that is the
 * UX-4C manual pass.
 */
export function DashboardSkeleton() {
  const theme = useTheme();
  const { t } = useLocalization();
  return (
    <>
      {[0, 1, 2].map((item) => (
        <Card key={item} accessibilityLabel={t('common.loadingContentAccessibility')}>
          <View
            style={{
              backgroundColor: theme.colors.surfaceVariant,
              borderRadius: theme.radius.medium,
              height: theme.spacing.xxl,
              marginBottom: theme.spacing.md,
              width: '54%',
            }}
          />
          <View
            style={{
              backgroundColor: theme.colors.surfaceVariant,
              borderRadius: theme.radius.medium,
              height: theme.spacing.lg,
              width: '86%',
            }}
          />
        </Card>
      ))}
    </>
  );
}
