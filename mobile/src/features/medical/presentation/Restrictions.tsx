import { useEffect } from 'react';
import { View } from 'react-native';

import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { Restriction } from '../domain/medical.types';
import { useRestrictionStore } from '../application/restriction.store';
import { RestrictionForm } from './RestrictionForm';

const TYPE_LABEL: Record<Restriction['type'], string> = {
  INJURY: 'Injury',
  CONDITION: 'Condition',
  DOCTOR_RESTRICTION: 'Doctor restriction',
};
const SYNC_LABEL: Record<Restriction['syncStatus'], string> = {
  pending: 'Pending sync',
  synced: 'Synced',
  conflict: 'Sync conflict',
};

function summary(r: Restriction): string {
  const parts = [TYPE_LABEL[r.type]];
  if (r.bodyArea) parts.push(r.bodyArea);
  if (r.severity) parts.push(r.severity.toLowerCase());
  return parts.join(' · ');
}

function RestrictionItem({
  restriction,
  onEnd,
  busy,
}: {
  restriction: Restriction;
  onEnd: (id: string) => void;
  busy: boolean;
}) {
  const theme = useTheme();
  return (
    <Card accessibilityLabel={`Restriction: ${summary(restriction)}`}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label">{summary(restriction)}</AppText>
        <AppText
          variant="caption"
          tone={restriction.syncStatus === 'conflict' ? 'warning' : 'muted'}
        >
          {SYNC_LABEL[restriction.syncStatus]}
        </AppText>
        <AppButton
          accessibilityLabel={`End restriction: ${summary(restriction)}`}
          testID={`restriction-end-${restriction.id}`}
          variant="text"
          loading={busy}
          onPress={() => onEnd(restriction.id)}
        >
          End restriction
        </AppButton>
      </View>
    </Card>
  );
}

/**
 * Restrictions / injuries management (Phase 14 Slice 2). Adds active
 * restrictions (encrypted free-text notes via the repository) and lists /
 * ends the active ones. Active restrictions flow into the iCoach engine
 * through the existing dashboard adapter, so ending one changes the next
 * assessment's training safety output.
 */
export function Restrictions() {
  const theme = useTheme();
  const { status, restrictions, error, load, deactivate } = useRestrictionStore();

  useEffect(() => {
    void load();
  }, [load]);

  const initialLoading = status === 'loading' && restrictions.length === 0;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">Restrictions & injuries</AppText>
        <AppText tone="muted">
          Active restrictions personalize your training safety. Notes are encrypted on your device.
        </AppText>
      </View>

      {error ? (
        <Banner title="Something went wrong" tone="error">
          {error}
        </Banner>
      ) : null}

      <RestrictionForm />

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="title">Active restrictions</AppText>
        {initialLoading ? (
          <AppText accessibilityLabel="Loading restrictions">Loading…</AppText>
        ) : restrictions.length === 0 ? (
          <AppText tone="muted">No active restrictions.</AppText>
        ) : (
          restrictions.map((restriction) => (
            <RestrictionItem
              key={restriction.id}
              restriction={restriction}
              busy={status === 'saving'}
              onEnd={(id) => {
                void deactivate(id);
              }}
            />
          ))
        )}
      </View>
    </View>
  );
}
