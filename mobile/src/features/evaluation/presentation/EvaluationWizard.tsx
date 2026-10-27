import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatNumber, interpolate, useLocalization } from '@/shared/localization';
import {
  AppButton,
  AppText,
  Banner,
  Icon,
  Screen,
  StageSurfaceProvider,
  withAlpha,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { previewEvaluation } from '../application/evaluation.service';
import { useEvaluationStore, type EvaluationMode } from '../application/evaluation.store';
import {
  EVALUATION_STEPS,
  stepIssues,
  type EvaluationStep,
  type StepIssue,
} from '../domain/evaluation';
import { STEP_TITLE } from './evaluation-copy';
import { FoodStep } from './steps/food-step';
import { GoalStep } from './steps/goal-step';
import { HealthStep } from './steps/health-step';
import { LifestyleStep } from './steps/lifestyle-step';
import { MeasuresStep } from './steps/measures-step';
import { ReviewStep } from './steps/review-step';

interface EvaluationWizardProps {
  mode: EvaluationMode;
  /** Called once the evaluation is saved. */
  onSaved: () => void;
  /** Leaves the wizard (update mode only; the first run has no way around it). */
  onExit?: () => void;
}

/**
 * Evaluación física — the six-step wizard of the design (README "Evaluación
 * física (6 pasos)"). First run: it is the only way into the app after email
 * verification and ends with "Generar mi plan con iCoach". From Perfil →
 * "Actualizar evaluación" it opens on the saved data and saves in place.
 */
export function EvaluationWizard({ mode, onSaved, onExit }: EvaluationWizardProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { language, t } = useLocalization();
  const status = useEvaluationStore((s) => s.status);
  const draft = useEvaluationStore((s) => s.draft);
  const sources = useEvaluationStore((s) => s.sources);
  const saving = useEvaluationStore((s) => s.saving);
  const saveFailed = useEvaluationStore((s) => s.saveFailed);
  const start = useEvaluationStore((s) => s.start);
  const update = useEvaluationStore((s) => s.update);
  const save = useEvaluationStore((s) => s.save);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState<StepIssue[]>([]);
  const body = useRef<ScrollView>(null);

  useEffect(() => {
    void start(mode);
  }, [mode, start]);

  const step: EvaluationStep = EVALUATION_STEPS[index];
  const today = sources?.today ?? '';
  const isReview = step === 'review';
  const preview = useMemo(
    () => (isReview && draft && sources ? previewEvaluation(draft, sources) : null),
    [isReview, draft, sources],
  );

  const goStep = (next: number) => {
    setShown([]);
    setIndex(next);
    body.current?.scrollTo({ y: 0, animated: false });
  };

  if (status !== 'ready' || !draft) {
    return (
      <Screen stage>
        <StageSurfaceProvider>
          {status === 'error' ? (
            <View style={{ gap: spacing.md }}>
              <Banner title={t('evaluation.loadError')} tone="error" />
              <AppButton onPress={() => void start(mode)} testID="evaluation-retry">
                {t('evaluation.retry')}
              </AppButton>
            </View>
          ) : (
            <ActivityIndicator
              accessibilityLabel={t('common.loadingContentAccessibility')}
              color={colors.accentCyan}
              testID="evaluation-loading"
            />
          )}
        </StageSurfaceProvider>
      </Screen>
    );
  }

  const next = async () => {
    const issues = stepIssues(step, draft, today);
    if (issues.length > 0) {
      setShown(issues);
      return;
    }
    if (!isReview) {
      goStep(index + 1);
      return;
    }
    if (await save()) onSaved();
  };

  // Only what still applies: a fixed field drops its message at once.
  const current = stepIssues(step, draft, today);
  const stepProps = {
    draft,
    update,
    issues: shown.filter((issue) => current.includes(issue)),
    today,
  };
  const eyebrow = interpolate(
    t(mode === 'update' ? 'evaluation.eyebrowUpdate' : 'evaluation.eyebrow'),
    {
      step: formatNumber(index + 1, language),
      total: formatNumber(EVALUATION_STEPS.length, language),
    },
  );
  const canGoBack = index > 0 || (mode === 'update' && onExit);

  return (
    <Screen scroll={false} stage style={{ gap: 0, padding: 0 }}>
      <StageSurfaceProvider>
        <View style={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.md }}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            {canGoBack ? (
              <Pressable
                accessibilityLabel={t(index > 0 ? 'evaluation.back' : 'evaluation.close')}
                accessibilityRole="button"
                onPress={() => (index > 0 ? goStep(index - 1) : onExit?.())}
                style={({ pressed }) => [
                  styles.center,
                  {
                    backgroundColor: withAlpha(colors.onStage, pressed ? 0.2 : 0.1),
                    borderRadius: theme.radius.full,
                    minHeight: theme.spacing.x5l,
                    minWidth: theme.spacing.x5l,
                  },
                ]}
                testID="evaluation-back"
              >
                <Icon color={colors.onStage} name={index > 0 ? 'back' : 'x'} size={20} />
              </Pressable>
            ) : null}
            <View style={styles.grow}>
              <AppText
                style={{ color: colors.accentCyan }}
                testID="evaluation-eyebrow"
                variant="caption"
              >
                {eyebrow}
              </AppText>
              <AppText accessibilityRole="header" tone="onStage" variant="headline">
                {t(STEP_TITLE[step])}
              </AppText>
            </View>
          </View>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.row, { gap: spacing.xs }]}
          >
            {EVALUATION_STEPS.map((name, i) => (
              <View
                key={name}
                style={{
                  backgroundColor: i <= index ? colors.accentCyan : withAlpha(colors.onStage, 0.15),
                  borderRadius: theme.radius.full,
                  flex: 1,
                  height: 6,
                }}
              />
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingTop: spacing.sm }}
          keyboardShouldPersistTaps="handled"
          ref={body}
          style={styles.grow}
          testID="evaluation-body"
        >
          {step === 'measures' ? <MeasuresStep {...stepProps} /> : null}
          {step === 'health' ? <HealthStep {...stepProps} /> : null}
          {step === 'food' ? <FoodStep {...stepProps} /> : null}
          {step === 'lifestyle' ? <LifestyleStep {...stepProps} /> : null}
          {step === 'goal' ? <GoalStep {...stepProps} /> : null}
          {step === 'review' ? (
            <ReviewStep
              {...stepProps}
              goStep={(target) => goStep(EVALUATION_STEPS.indexOf(target))}
              preview={preview}
            />
          ) : null}
        </ScrollView>

        <View
          style={{
            backgroundColor: withAlpha(colors.stageDeep, 0.85),
            borderColor: withAlpha(colors.onStage, 0.1),
            borderTopWidth: 1,
            gap: spacing.sm,
            padding: spacing.lg,
            paddingTop: spacing.md,
          }}
        >
          {saveFailed ? <Banner title={t('evaluation.saveError')} tone="error" /> : null}
          <AppButton
            loading={saving}
            onPress={() => void next()}
            testID="evaluation-continue"
            variant="primary"
          >
            {isReview
              ? t(mode === 'update' ? 'evaluation.saveUpdate' : 'evaluation.generate')
              : t('evaluation.continue')}
          </AppButton>
        </View>
      </StageSurfaceProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  row: { alignItems: 'center', flexDirection: 'row' },
});
