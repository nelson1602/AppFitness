import { useState, useEffect } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTranslation } from 'react-i18next'
import {
  Dumbbell, Trophy, Flame, Target,
  AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Calendar,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { StatCard } from '@/features/dashboard/components/StatCard'
import { fetchProgressReport } from '@/features/progress/api'
import { MeasurementsSection } from '@/features/measurements/components/MeasurementsSection'
import type { ProgressReport } from '@/types/progress'

export const ProgressPage = () => {
  usePageTitle('Progress')
  const { t } = useTranslation()
  const [report,  setReport]  = useState<ProgressReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProgressReport()
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-7 h-7 text-primary" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-text-secondary text-sm">Could not load progress data.</p>
      </div>
    )
  }

  const adherencePct    = Math.round(report.adherenceRate * 100)
  const weightUp        = report.weeklyWeightChange > 0.05
  const weightDown      = report.weeklyWeightChange < -0.05
  const volumeUp        = report.weeklyVolumeChange > 0
  const adherenceColor  = adherencePct >= 80 ? '#CCFF00' : adherencePct >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <div className="flex flex-col gap-5 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('progress.title')}</h1>
        <p className="text-sm text-text-secondary mt-1">{t('progress.subtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label={t('progress.stats.workouts')}
          value={report.totalWorkouts}
          icon={<Dumbbell className="w-4 h-4" />}
        />
        <StatCard
          label={t('progress.stats.prs')}
          value={report.totalPRs}
          icon={<Trophy className="w-4 h-4" />}
          accent={report.totalPRs > 0}
        />
        <StatCard
          label={t('progress.stats.streak')}
          value={report.currentStreak}
          unit={report.currentStreak === 1 ? t('common.day') : t('common.days')}
          icon={<Flame className="w-4 h-4" />}
          accent={report.currentStreak > 2}
        />
        <StatCard
          label={t('progress.stats.adherence')}
          value={`${adherencePct}%`}
          sub={t('progress.stats.thisWeek')}
          icon={<Target className="w-4 h-4" />}
          accent={adherencePct >= 80}
        />
      </div>

      {/* Deload alert */}
      {report.deloadDecision.shouldDeload && (
        <Card className="flex items-start gap-3 border-primary/30 bg-primary/5">
          <RefreshCw className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-text-primary">{t('progress.deload.title')}</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {report.deloadDecision.reason ?? t('progress.deload.message')}
            </p>
          </div>
        </Card>
      )}

      {/* Plateau alert */}
      {report.weightPlateau.detected && (
        <Card className="flex items-start gap-3" style={{ borderColor: 'rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.05)' }}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
          <div>
            <p className="text-sm font-semibold text-text-primary">{t('progress.plateau.title')}</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {report.weightPlateau.durationWeeks
                ? t('progress.plateau.duration', { duration: report.weightPlateau.durationWeeks })
                : t('progress.plateau.message')}
              {report.weightPlateau.recommendation ? ` ${report.weightPlateau.recommendation}` : ''}
            </p>
          </div>
        </Card>
      )}

      {/* Goal timeline */}
      {report.goalPrediction.canPredict ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-text-primary">{t('progress.goalTimeline.title')}</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-text-muted mb-1">{t('progress.goalTimeline.estimated')}</p>
              <p className="text-sm font-semibold text-text-primary">{report.goalPrediction.estimatedDate ?? '–'}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">{t('progress.goalTimeline.weeksLeft')}</p>
              <p className="text-sm font-semibold text-text-primary">
                {report.goalPrediction.weeksRemaining != null ? `${report.goalPrediction.weeksRemaining}w` : '–'}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">{t('progress.goalTimeline.rate')}</p>
              <p className="text-sm font-semibold text-text-primary">
                {report.goalPrediction.weeklyRateKg != null
                  ? `${report.goalPrediction.weeklyRateKg > 0 ? '+' : ''}${report.goalPrediction.weeklyRateKg} kg`
                  : '–'}
              </p>
            </div>
          </div>
          {report.goalPrediction.confidencePercent != null && (
            <div>
              <div className="flex justify-between text-xs text-text-muted mb-1">
                <span>{t('progress.goalTimeline.confidence')}</span>
                <span>{report.goalPrediction.confidencePercent}%</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${report.goalPrediction.confidencePercent}%` }}
                />
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="py-8 flex flex-col items-center gap-2 text-center">
          <Calendar className="w-8 h-8 text-text-muted" />
          <p className="text-sm text-text-secondary">
            {report.goalPrediction.reason ?? t('progress.goalTimeline.logNeeded')}
          </p>
        </Card>
      )}

      {/* Weekly trend cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col gap-2">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{t('progress.weightTrend')}</p>
          <div className="flex items-center gap-2">
            {weightUp ? (
              <TrendingUp className="w-5 h-5" style={{ color: '#F59E0B' }} />
            ) : weightDown ? (
              <TrendingDown className="w-5 h-5 text-primary" />
            ) : (
              <span className="text-lg text-text-muted">—</span>
            )}
            <span className="text-xl font-bold text-text-primary">
              {report.weeklyWeightChange > 0 ? '+' : ''}{report.weeklyWeightChange.toFixed(2)} kg
            </span>
          </div>
          <p className="text-xs text-text-muted">{t('progress.vsPrev')}</p>
        </Card>

        <Card className="flex flex-col gap-2">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{t('progress.volumeTrend')}</p>
          <div className="flex items-center gap-2">
            {volumeUp ? (
              <TrendingUp className="w-5 h-5 text-primary" />
            ) : (
              <TrendingDown className="w-5 h-5" style={{ color: '#F59E0B' }} />
            )}
            <span className="text-xl font-bold text-text-primary">
              {report.weeklyVolumeChange > 0 ? '+' : ''}{report.weeklyVolumeChange}%
            </span>
          </div>
          <p className="text-xs text-text-muted">{t('progress.vsPrev')}</p>
        </Card>
      </div>

      {/* Body measurements */}
      <MeasurementsSection />

      {/* Adherence breakdown */}
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold text-text-primary">{t('progress.adherenceTitle')}</h2>
        <div className="flex justify-between text-sm mb-0.5">
          <span className="text-text-secondary">
            {t('progress.daysTrained', { actual: report.trainingDaysActual, target: report.trainingDaysTarget })}
          </span>
          <span className="font-semibold text-text-primary">{adherencePct}%</span>
        </div>
        <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(adherencePct, 100)}%`, backgroundColor: adherenceColor }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: report.trainingDaysTarget }).map((_, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
              style={{
                backgroundColor: i < report.trainingDaysActual ? 'rgba(204,255,0,0.15)' : 'var(--surface-2)',
                color:           i < report.trainingDaysActual ? '#CCFF00' : 'var(--text-muted)',
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
