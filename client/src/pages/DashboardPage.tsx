import { useState, useEffect, useCallback } from 'react'
import { Dumbbell, Flame, Scale, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { StatCard } from '@/features/dashboard/components/StatCard'
import { WeightChart } from '@/features/dashboard/components/WeightChart'
import { VolumeChart } from '@/features/dashboard/components/VolumeChart'
import { NutritionWeekChart } from '@/features/dashboard/components/NutritionWeekChart'
import { LogWeightModal } from '@/features/dashboard/components/LogWeightModal'
import {
  fetchSummary,
  fetchWeightHistory,
  fetchWeeklyVolume,
  fetchNutritionWeek,
} from '@/features/dashboard/api'
import { useAuthStore } from '@/store/auth.store'
import type { DashboardSummary, WeightEntry, WeeklyVolume, DailyNutrition } from '@/types/dashboard'

const fmtVol = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}`

const fmtDate = (s: string | null) => {
  if (!s) return undefined
  const d = new Date(s + 'T12:00:00')
  const today = new Date().toISOString().split('T')[0]
  if (s === today) return 'Today'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const DashboardPage = () => {
  const user = useAuthStore((s) => s.user)

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [volume, setVolume] = useState<WeeklyVolume[]>([])
  const [nutrition, setNutrition] = useState<DailyNutrition[]>([])
  const [loading, setLoading] = useState(true)
  const [weightModalOpen, setWeightModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [s, w, v, n] = await Promise.all([
      fetchSummary(),
      fetchWeightHistory(),
      fetchWeeklyVolume(),
      fetchNutritionWeek(),
    ])
    setSummary(s)
    setWeights(w)
    setVolume(v)
    setNutrition(n)
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
          Hey, {user?.username} 👋
        </h1>
        <p className="text-sm text-text-secondary mt-1">{today}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-7 h-7 text-primary" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              label="Workouts"
              value={summary?.workoutsThisWeek ?? 0}
              unit="this week"
              icon={<Dumbbell className="w-4 h-4" />}
            />
            <StatCard
              label="Volume"
              value={fmtVol(summary?.volumeThisWeek ?? 0)}
              unit="kg"
              sub="this week"
              icon={<Flame className="w-4 h-4" />}
            />
            <StatCard
              label="Body weight"
              value={summary?.latestWeight ?? '–'}
              unit={summary?.latestWeight ? 'kg' : undefined}
              sub={fmtDate(summary?.latestWeightDate ?? null) ?? 'not logged'}
              icon={<Scale className="w-4 h-4" />}
              accent={!!summary?.latestWeight}
            />
          </div>

          {/* Body weight chart */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-text-primary">Body Weight</h2>
                <p className="text-xs text-text-muted mt-0.5">Last 12 weeks</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setWeightModalOpen(true)}
              >
                <Plus className="w-4 h-4" /> Log
              </Button>
            </div>
            <WeightChart data={weights} />
          </Card>

          {/* Weekly volume chart */}
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-text-primary">Training Volume</h2>
              <p className="text-xs text-text-muted mt-0.5">Last 8 weeks (kg lifted)</p>
            </div>
            <VolumeChart data={volume} />
          </Card>

          {/* Nutrition week chart */}
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-text-primary">This Week's Nutrition</h2>
              <p className="text-xs text-text-muted mt-0.5">Daily calories by macro (kcal)</p>
            </div>
            <NutritionWeekChart data={nutrition} />
          </Card>
        </>
      )}

      <LogWeightModal
        open={weightModalOpen}
        onClose={() => setWeightModalOpen(false)}
        onSaved={handleWeightSaved}
        latestWeight={summary?.latestWeight}
      />
    </div>
  )
}
