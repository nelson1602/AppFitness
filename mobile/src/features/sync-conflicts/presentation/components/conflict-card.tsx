import { View } from 'react-native';

import type { ConflictFieldComparison, LocalConflictView } from '@/shared/infrastructure/sync';
import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { ConflictChoice } from '../../application/sync-conflicts.store';
import {
  CHOICE_COPY,
  COMPARISON,
  fieldLabel,
  recordLabel,
  SETTLEMENT_CHIP,
  SIDE,
} from '../conflict-copy';
import { orderedFields, treatmentFor } from '../conflict-treatment';
import {
  formatCalendarDate,
  formatInstant,
  renderValue,
  type RenderedValue,
} from '../conflict-value';

interface ConflictCardProps {
  view: LocalConflictView;
  /** Position in the list. Used for test handles so no id is ever rendered. */
  position: number;
  busy: boolean;
  onChoose: (conflictId: string, choice: ConflictChoice) => void;
  onRetry: (conflictId: string) => void;
}

/**
 * One conflict, reviewed inline — ADR-P030 **C-6**.
 *
 * A renderer over the C-4 view and the pure treatment decision. It holds no
 * state, reaches no service and formats no copy of its own: every string comes
 * from an approved C-5 key, and every value from the allow-listed presenter.
 *
 * Nothing identifying is drawn. The conflict id travels only as the argument of
 * a callback; the record is named by its **kind** and its own date, never by an
 * id, and the two sides are told apart **in text** so nothing depends on colour.
 */
export function ConflictCard({ view, position, busy, onChoose, onRetry }: ConflictCardProps) {
  const theme = useTheme();
  const { t } = useLocalization();
  const treatment = treatmentFor(view);
  const model = treatment.model;

  const kindLabel = model ? recordLabel(model.entityKind) : null;

  return (
    <Card style={{ gap: theme.spacing.md }} testID={`conflict-card-${position}`}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="title">
          {kindLabel ? t(kindLabel) : t('sync.conflicts.blocked.unsupportedTitle')}
        </AppText>
        {model ? (
          <AppText variant="caption" tone="muted">
            {t('sync.conflicts.meta.status')}: {t(SETTLEMENT_CHIP[model.settlement])}
          </AppText>
        ) : null}
      </View>

      {treatment.notice ? (
        // Conflict is `warning`, never `error` (ADR-P022; BUG-007). A recorded
        // choice borrows the reassuring Pending-sync tone instead.
        <Banner
          title={t(treatment.notice.title)}
          tone={treatment.kind === 'recorded' || treatment.kind === 'settled' ? 'info' : 'warning'}
        >
          {t(treatment.notice.body)}
        </Banner>
      ) : null}

      {model && treatment.showFields ? (
        <View style={{ gap: theme.spacing.md }}>
          <ConflictMeta model={model} />
          {orderedFields(model).map((field) => (
            <FieldComparison key={field.field} field={field} />
          ))}
        </View>
      ) : null}

      {treatment.choices.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" tone="muted">
            {t('sync.conflicts.choice.noChangeYet')}
          </AppText>
          {treatment.choices.map((choice) => (
            <ChoiceControl
              busy={busy}
              choice={choice}
              key={choice}
              onPress={() => onChoose(view.id, choice)}
              position={position}
            />
          ))}
        </View>
      ) : null}

      {treatment.canRetry ? (
        <AppButton
          accessibilityLabel={t('sync.conflicts.failedRetry')}
          loading={busy}
          onPress={() => onRetry(view.id)}
          testID={`conflict-retry-${position}`}
          variant="secondary"
        >
          {t('sync.conflicts.failedRetry')}
        </AppButton>
      ) : null}
    </Card>
  );
}

/**
 * The metadata §Decision 2 allows: the record's own date, the version the edit
 * started from, the version the account is on, and when the divergence was
 * noticed. No id, no owner, no payload.
 */
function ConflictMeta({ model }: { model: NonNullable<ReturnType<typeof treatmentFor>['model']> }) {
  const theme = useTheme();
  const { t, language } = useLocalization();

  const noticed = new Date(model.detectedAt);
  const rows: { label: string; value: string }[] = [];
  if (model.comparisonDate) {
    rows.push({
      label: t('sync.conflicts.meta.entryDate'),
      value: formatCalendarDate(model.comparisonDate, language),
    });
  }
  rows.push({
    label: t('sync.conflicts.meta.startingVersion'),
    value: String(model.baseVersion),
  });
  rows.push({
    label: t('sync.conflicts.meta.accountVersion'),
    value: String(model.currentServerVersion),
  });
  if (!Number.isNaN(noticed.getTime())) {
    rows.push({
      label: t('sync.conflicts.meta.noticed'),
      value: formatInstant(model.detectedAt, language),
    });
  }

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {rows.map((row) => (
        <AppText key={row.label} variant="caption" tone="muted">
          {row.label}: {row.value}
        </AppText>
      ))}
    </View>
  );
}

/**
 * One field, both sides, stacked. Stacking rather than columns is what keeps
 * this readable at large text sizes and on narrow screens: each side owns a
 * full line, wraps freely, and is introduced by its own words.
 */
function FieldComparison({ field }: { field: ConflictFieldComparison }) {
  const theme = useTheme();
  const { t, language } = useLocalization();
  const label = fieldLabel(field.field);

  // Fail closed: a field with no approved label is described, never named by
  // its identifier.
  const heading = label ? t(label) : t('sync.conflicts.value.hidden');

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="label">{heading}</AppText>
        {/* Text, not colour: the comparison is legible in monochrome. */}
        <AppText variant="caption" tone={field.comparison === 'same' ? 'muted' : 'warning'}>
          {t(COMPARISON[field.comparison])}
        </AppText>
      </View>
      <AppText variant="body">
        {t(SIDE.local)}: {readable(renderValue(field.local, field.field, field.kind, language), t)}
      </AppText>
      <AppText variant="body">
        {t(SIDE.server)}:{' '}
        {readable(renderValue(field.server, field.field, field.kind, language), t)}
      </AppText>
    </View>
  );
}

function ChoiceControl({
  busy,
  choice,
  onPress,
  position,
}: {
  busy: boolean;
  choice: ConflictChoice;
  onPress: () => void;
  position: number;
}) {
  const theme = useTheme();
  const { t } = useLocalization();
  const copy = CHOICE_COPY[choice];
  const handle = choice === 'RESOLVED_LOCAL_WINS' ? 'local' : 'account';

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppButton
        accessibilityLabel={t(copy.accessibility)}
        disabled={busy}
        onPress={onPress}
        testID={`conflict-choose-${handle}-${position}`}
        variant="secondary"
      >
        {t(copy.label)}
      </AppButton>
      <AppText variant="caption" tone="muted">
        {t(copy.description)}
      </AppText>
    </View>
  );
}

/** Resolves a rendered value to a string, localizing every copy variant. */
function readable(value: RenderedValue, t: ReturnType<typeof useLocalization>['t']): string {
  if (value.kind === 'text') return value.text;
  // Punctuation between token labels, not copy.
  if (value.kind === 'keys') return value.keys.map((key) => t(key)).join(', ');
  return t(value.key);
}
