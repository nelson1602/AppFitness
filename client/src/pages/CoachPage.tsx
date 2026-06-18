import { useState, useEffect, useCallback } from 'react'
import { Spinner }   from '@/components/ui/Spinner'
import { ReadinessCard } from '@/features/health/components/ReadinessCard'
import { HealthLogForm } from '@/features/health/components/HealthLogForm'
import { NutritionRecommendationCard, TrainingRecommendationCard } from '@/features/coach/components/RecommendationCard'
import { ProgressInsights } from '@/features/coach/components/ProgressInsights'
import { GoalTimeline }     from '@/features/coach/components/GoalTimeline'
import { fetchCoachReport }  from '@/features/coach/api'
import { fetchTodayHealth }  from '@/features/health/api'
import type { CoachReport }  from '@/types/engines'
import type { ReadinessScore } from '@/types/engines'

const today = () => new Date().toISOString().split('T')[0]

export const CoachPage = () => {
  const [report,    setReport]    = useState<CoachReport | null>(null)
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null)
  const [hasLog,    setHasLog]    = useState(false)
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [rep, health] = await Promise.all([
      fetchCoachReport(),
      fetchTodayHealth(),
    ])
    setReport(rep)
    setReadiness(health.readiness)
    setHasLog(!!health.log)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleHealthSaved = (r: ReadinessScore) => {
    setReadiness(r)
    setHasLog(true)
    load()  // re-fetch report with updated readiness
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-7 h-7 text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">AI Coach</h1>
        <p className="text-sm text-text-secondary mt-1">Your personalized digital personal trainer</p>
      </div>

      {/* Readiness */}
      {readiness && <ReadinessCard readiness={readiness} />}

      {/* Daily check-in form if not logged yet */}
      {!hasLog && (
        <HealthLogForm date={today()} onSaved={handleHealthSaved} />
      )}

      {report && (
        <>
          {/* Insights & notifications */}
          <ProgressInsights
            analysis={report.progressAnalysis}
            notifications={report.notifications}
          />

          {/* Goal timeline */}
          <GoalTimeline prediction={report.progressAnalysis.goalPrediction} />

          {/* Nutrition recommendation */}
          <NutritionRecommendationCard rec={report.nutritionRecommendation} />

          {/* Training recommendation */}
          <TrainingRecommendationCard rec={report.trainingRecommendation} />

          {/* Summary */}
          <div className="bg-surface-2 rounded-xl border border-border p-4">
            <h3 className="font-semibold text-text-primary mb-2">Weekly Summary</h3>
            <pre className="text-xs text-text-secondary whitespace-pre-wrap font-sans leading-relaxed">
              {report.summary}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
