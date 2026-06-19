import { useState, useEffect, useCallback } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Plus, Dumbbell, Clock, Flame } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { RoutineCard } from '@/features/workouts/components/RoutineCard'
import { RoutineCardSkeleton } from '@/features/workouts/components/RoutineCardSkeleton'
import { fetchRoutines, deleteRoutine, startWorkout, fetchLogs } from '@/features/workouts/api'
import type { Routine, WorkoutLog } from '@/types/workout'

type Tab = 'routines' | 'history'

const duration = (log: WorkoutLog) => {
  if (!log.finishedAt) return '–'
  const mins = Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 60_000)
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
}

const volume = (log: WorkoutLog) =>
  log.sets
    .filter((s) => s.completed && s.weight && s.reps)
    .reduce((acc, s) => acc + (s.weight! * s.reps!), 0)

export const WorkoutsPage = () => {
  usePageTitle('Workouts')
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('routines')
  const [routines, setRoutines] = useState<Routine[]>([])
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    const [r, l] = await Promise.all([fetchRoutines(), fetchLogs({ limit: 20 })])
    setRoutines(r)
    setLogs(l)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteRoutine(deleteId)
      setRoutines((prev) => prev.filter((r) => r.id !== deleteId))
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleStart = async (routine: Routine) => {
    const log = await startWorkout({ name: routine.name, routineId: routine.id })
    navigate(`/workouts/active/${log.id}`)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('workouts.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('workouts.subtitle')}</p>
        </div>
        {tab === 'routines' && (
          <Button size="sm" onClick={() => navigate('/workouts/new')}>
            <Plus className="w-4 h-4" />
            {t('common.new')}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg w-fit">
        {(['routines', 'history'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === tabKey ? 'bg-surface-2 text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t(`workouts.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <RoutineCardSkeleton />
          <RoutineCardSkeleton />
        </div>
      ) : tab === 'routines' ? (
        routines.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-16 text-center">
            <Dumbbell className="w-10 h-10 text-text-muted" />
            <p className="text-text-secondary text-sm">{t('workouts.emptyRoutines')}</p>
            <Button size="sm" onClick={() => navigate('/workouts/new')}>
              <Plus className="w-4 h-4" /> {t('workouts.createFirst')}
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {routines.map((r) => (
              <RoutineCard key={r.id} routine={r} onDelete={setDeleteId} onStart={handleStart} />
            ))}
          </div>
        )
      ) : (
        logs.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-16 text-center">
            <Clock className="w-10 h-10 text-text-muted" />
            <p className="text-text-secondary text-sm">{t('workouts.emptyHistory')}</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {logs.map((log) => {
              const vol = volume(log)
              const uniqueEx = new Set(log.sets.map((s) => s.exerciseId)).size
              return (
                <Card
                  key={log.id}
                  className={`flex flex-col gap-2 ${log.finishedAt ? 'cursor-pointer hover:border-primary/40 transition-colors' : ''}`}
                  onClick={() => log.finishedAt && navigate(`/workouts/log/${log.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">{log.name}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(log.startedAt).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                      </p>
                    </div>
                    {!log.finishedAt ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/workouts/active/${log.id}`) }}
                        className="text-xs text-primary font-medium"
                      >
                        {t('common.resume')}
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted">{t('common.view')}</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {duration(log)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Dumbbell className="w-3.5 h-3.5" /> {uniqueEx} exercises · {log.sets.filter(s => s.completed).length} sets
                    </span>
                    {vol > 0 && (
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" /> {t('workouts.vol', { vol: vol.toLocaleString() })}
                      </span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}
      <ConfirmModal
        open={!!deleteId}
        title={t('workouts.deleteModal.title')}
        message={t('workouts.deleteModal.message')}
        confirmLabel={t('common.delete')}
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteId(null)}
      />
    </div>
  )
}
