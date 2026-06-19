import { useState, useEffect, useCallback } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTranslation } from 'react-i18next'
import { Dumbbell, Flame, Scale, Plus, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DashboardSkeleton } from '@/features/dashboard/components/DashboardSkeleton'
import { StatCard } from '@/features/dashboard/components/StatCard'
import { WeightChart } from '@/features/dashboard/components/WeightChart'
import { VolumeChart } from '@/features/dashboard/components/VolumeChart'
import { NutritionWeekChart } from '@/features/dashboard/components/NutritionWeekChart'
import { LogWeightModal } from '@/features/dashboard/components/LogWeightModal'
import { FitnessScoreCard } from '@/features/dashboard/components/FitnessScoreCard'
import { CoachInsightCard } from '@/features/dashboard/components/CoachInsightCard'
import { WellnessCard }     from '@/features/health/components/WellnessCard'
import { SupplementsCard } from '@/features/supplements/components/SupplementsCard'
import { ReevaluationBanner } from '@/features/reevaluation/components/ReevaluationBanner'
import { ReevaluationModal } from '@/features/reevaluation/components/ReevaluationModal'
import {
  fetchSummary,
  fetchWeightHistory,
  fetchWeeklyVolume,
  fetchNutritionWeek,
  fetchCoachInsight,
} from '@/features/dashboard/api'
import { useAuthStore } from '@/store/auth.store'
import type { DashboardSummary, WeightEntry, WeeklyVolume, DailyNutrition, CoachInsight } from '@/types/dashboard'

const fmtVol = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}`

export const DashboardPage = () => {
  usePageTitle('Dashboard')
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  const [summary,      setSummary]      = useState<DashboardSummary | null>(null)
  const [weights,      setWeights]      = useState<WeightEntry[]>([])
  const [volume,       setVolume]       = useState<WeeklyVolume[]>([])
  const [nutrition,    setNutrition]    = useState<DailyNutrition[]>([])
  const [coachInsight, setCoachInsight] = useState<CoachInsight | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [weightModalOpen,    setWeightModalOpen]    = useState(false)
  const [reevalModalOpen,    setReevalModalOpen]    = useState(false)

  const fmtDate = (s: string | null) => {
    if (!s) return undefined
    const d = new Date(s + 'T12:00:00')
    const today = new Date().toISOString().split('T')[0]
    if (s === today) return t('common.today')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [s, w, v, n, ci] = await Promise.all([
      fetchSummary(),
      fetchWeightHistory(),
      fetchWeeklyVolume(),
      fetchNutritionWeek(),
      fetchCoachInsight().catch(() => null),
    ])
    setSummary(s)
    setWeights(w)
    setVolume(v)
    setNutrition(n)
    setCoachInsight(ci)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleWeightSaved = (entry: WeightEntry) => {
    setWeights((prev) => {
      const filtered = prev.filter((w) => w.date !== entry.date)
      return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date))
    })
    setSummary((prev) =>
      prev ? { ...prev, latestWeight: entry.weight, latestWeightDate: entry.date } : prev,
    )
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('dashboard.greeting', { name: user?.username })}
        </h1>
        <p className="text-sm text-text-secondary mt-1">{today}</p>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Reevaluation banner */}
          {coachInsight && coachInsight.daysToNextEval <= 0 && (
            <ReevaluationBanner
              overdue={coachInsight.daysToNextEval === 0}
              onStart={() => setReevalModalOpen(true)}
            />
          )}

          {/* Fitness Score */}
          {summary && <FitnessScoreCard score={summary.fitnessScore} />}

          {/* Daily Wellness */}
          <WellnessCard />

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              label={t('dashboard.stats.workouts')}
              value={summary?.workoutsThisWeek ?? 0}
              unit={t('dashboard.thisWeek')}
              icon={<Dumbbell className="w-4 h-4" />}
            />
            <StatCard
              label={t('dashboard.stats.volume')}
              value={fmtVol(summary?.volumeThisWeek ?? 0)}
              unit="kg"
              sub={t('dashboard.thisWeek')}
              icon={<Flame className="w-4 h-4" />}
            />
            <StatCard
              label={t('dashboard.stats.bodyWeight')}
              value={summary?.latestWeight ?? '–'}
              unit={summary?.latestWeight ? t('common.kg') : undefined}
              sub={fmtDate(summary?.latestWeightDate ?? null) ?? t('dashboard.stats.notLogged')}
              icon={<Scale className="w-4 h-4" />}
              accent={!!summary?.latestWeight}
            />
            <StatCard
              label={t('dashboard.stats.streak')}
              value={summary?.streak ?? 0}
              unit={summary?.streak === 1 ? t('common.day') : t('common.days')}
              icon={<Flame className="w-4 h-4" />}
              accent={(summary?.streak ?? 0) > 2}
            />
            <StatCard
              label={t('dashboard.stats.level')}
              value={summary?.level ?? 1}
              sub={`${summary?.xp ?? 0} / ${summary?.nextLevelXp ?? 500} XP`}
              icon={<Zap className="w-4 h-4" />}
              accent={(summary?.level ?? 1) > 1}
            />
          </div>

          {/* AI Coach insight */}
          {coachInsight && <CoachInsightCard insight={coachInsight} />}

          {/* Body weight chart */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-text-primary">{t('dashboard.bodyWeightCard.title')}</h2>
                <p className="text-xs text-text-muted mt-0.5">{t('dashboard.bodyWeightCard.subtitle')}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setWeightModalOpen(true)}
              >
                <Plus className="w-4 h-4" /> {t('common.log')}
              </Button>
            </div>
            <WeightChart data={weights} />
          </Card>

          {/* Weekly volume chart */}
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-text-primary">{t('dashboard.trainingVolume.title')}</h2>
              <p className="text-xs text-text-muted mt-0.5">{t('dashboard.trainingVolume.subtitle')}</p>
            </div>
            <VolumeChart data={volume} />
          </Card>

          {/* Nutrition week chart */}
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-text-primary">{t('dashboard.nutritionWeek.title')}</h2>
              <p className="text-xs text-text-muted mt-0.5">{t('dashboard.nutritionWeek.subtitle')}</p>
            </div>
            <NutritionWeekChart data={nutrition} />
          </Card>

          {/* Supplement suggestions (unlocks after first week of training) */}
          <SupplementsCard />
        </>
      )}

      <LogWeightModal
        open={weightModalOpen}
        onClose={() => setWeightModalOpen(false)}
        onSaved={handleWeightSaved}
        latestWeight={summary?.latestWeight}
      />

      <ReevaluationModal
        open={reevalModalOpen}
        onClose={() => setReevalModalOpen(false)}
        onComplete={() => { setReevalModalOpen(false); load() }}
        latestWeight={summary?.latestWeight}
      />
    </div>
  )
}
