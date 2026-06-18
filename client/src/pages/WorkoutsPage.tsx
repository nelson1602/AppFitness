import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Dumbbell, Clock, Flame } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { RoutineCard } from '@/features/workouts/components/RoutineCard'
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
  const [tab, setTab] = useState<Tab>('routines')
  const [routines, setRoutines] = useState<Routine[]>([])
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    const [r, l] = await Promise.all([fetchRoutines(), fetchLogs({ limit: 20 })])
    setRoutines(r)
    setLogs(l)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this routine?')) return
    await deleteRoutine(id)
    setRoutines((prev) => prev.filter((r) => r.id !== id))
  }

  const handleStart = async (routine: Routine) => {
    const log = await startWorkout({ name: routine.name, routineId: routine.id })
    navigate(`/workouts/active/${log.id}`)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Workouts</h1>
          <p className="text-sm text-text-secondary mt-1">Your routines and training logs</p>
        </div>
        {tab === 'routines' && (
          <Button size="sm" onClick={() => navigate('/workouts/new')}>
            <Plus className="w-4 h-4" />
            New
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg w-fit">
        {(['routines', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-surface-2 text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="w-6 h-6 text-primary" />
        </div>
      ) : tab === 'routines' ? (
        routines.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-16 text-center">
            <Dumbbell className="w-10 h-10 text-text-muted" />
            <p className="text-text-secondary text-sm">No routines yet</p>
            <Button size="sm" onClick={() => navigate('/workouts/new')}>
              <Plus className="w-4 h-4" /> Create your first routine
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {routines.map((r) => (
              <RoutineCard key={r.id} routine={r} onDelete={handleDelete} onStart={handleStart} />
            ))}
          </div>
        )
      ) : (
        logs.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-16 text-center">
            <Clock className="w-10 h-10 text-text-muted" />
            <p className="text-text-secondary text-sm">No workouts logged yet</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {logs.map((log) => {
              const vol = volume(log)
              const uniqueEx = new Set(log.sets.map((s) => s.exerciseId)).size
              return (
                <Card key={log.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">{log.name}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(log.startedAt).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                      </p>
                    </div>
                    {!log.finishedAt && (
                      <button
                        onClick={() => navigate(`/workouts/active/${log.id}`)}
                        className="text-xs text-primary font-medium"
                      >
                        Resume →
                      </button>
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
                        <Flame className="w-3.5 h-3.5" /> {vol.toLocaleString()} kg vol
                      </span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
