import { useState, useEffect } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Dumbbell, Flame, CheckCircle2, Circle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { fetchLog } from '@/features/workouts/api'
import { ExerciseHistoryModal } from '@/features/workouts/components/ExerciseHistoryModal'
import type { WorkoutLog, WorkoutSet } from '@/types/workout'

const MUSCLE_COLORS: Record<string, string> = {
  Chest:     'bg-red-500/10 text-red-400 border-red-500/20',
  Back:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Legs:      'bg-green-500/10 text-green-400 border-green-500/20',
  Shoulders: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Arms:      'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Core:      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Cardio:    'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
}
const muscleColor = (group: string) =>
  MUSCLE_COLORS[group] ?? 'bg-primary/10 text-primary border-primary/20'

const duration = (log: WorkoutLog) => {
  if (!log.finishedAt) return null
  const mins = Math.round(
    (new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 60_000,
  )
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
}

const totalVolume = (sets: WorkoutSet[]) =>
  sets.filter((s) => s.completed && s.weight && s.reps)
      .reduce((acc, s) => acc + (s.weight! * s.reps!), 0)

type ExerciseGroup = {
  exerciseId: string
  name: string
  muscleGroup: string
  sets: WorkoutSet[]
}

const groupByExercise = (sets: WorkoutSet[]): ExerciseGroup[] => {
  const map = new Map<string, ExerciseGroup>()
  for (const s of sets) {
    if (!map.has(s.exerciseId)) {
      map.set(s.exerciseId, {
        exerciseId:  s.exerciseId,
        name:        s.exercise.name,
        muscleGroup: s.exercise.muscleGroup,
        sets:        [],
      })
    }
    map.get(s.exerciseId)!.sets.push(s)
  }
  return Array.from(map.values())
}

export const WorkoutLogDetailPage = () => {
  usePageTitle('Workout Log')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [log, setLog]         = useState<WorkoutLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [historyEx, setHistoryEx] = useState<{ id: string; name: string; muscleGroup: string } | null>(null)

  useEffect(() => {
    if (!id) return
    fetchLog(id)
      .then(setLog)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="w-6 h-6 text-primary" />
      </div>
    )
  }

  if (error || !log) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-text-secondary">Workout not found.</p>
        <button onClick={() => navigate('/workouts')} className="text-sm text-primary hover:underline">
          ← Back to workouts
        </button>
      </div>
    )
  }

  const groups    = groupByExercise(log.sets)
  const vol       = totalVolume(log.sets)
  const completed = log.sets.filter((s) => s.completed).length
  const dur       = duration(log)
  const dateLabel = new Date(log.startedAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="flex flex-col gap-5 animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/workouts')}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text-primary truncate">{log.name}</h1>
          <p className="text-xs text-text-muted">{dateLabel}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {dur && (
          <Card className="flex flex-col items-center gap-1 py-3">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-text-primary">{dur}</span>
            <span className="text-xs text-text-muted">Duration</span>
          </Card>
        )}
        <Card className="flex flex-col items-center gap-1 py-3">
          <Dumbbell className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-text-primary">{groups.length}</span>
          <span className="text-xs text-text-muted">Exercises</span>
        </Card>
        <Card className={`flex flex-col items-center gap-1 py-3 ${!dur ? 'col-span-2 sm:col-span-1' : ''}`}>
          <Flame className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-text-primary">
            {vol > 0 ? `${vol.toLocaleString()} kg` : `${completed} sets`}
          </span>
          <span className="text-xs text-text-muted">{vol > 0 ? 'Volume' : 'Sets done'}</span>
        </Card>
      </div>

      {/* Notes */}
      {log.notes && (
        <Card className="text-sm text-text-secondary italic border-l-2 border-primary/40 rounded-l-none pl-4">
          {log.notes}
        </Card>
      )}

      {/* Exercise groups */}
      {groups.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <Dumbbell className="w-10 h-10 text-text-muted" />
          <p className="text-text-secondary text-sm">No sets recorded</p>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.exerciseId} className="flex flex-col gap-3">
            {/* Exercise header */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistoryEx({ id: group.exerciseId, name: group.name, muscleGroup: group.muscleGroup })}
                className="font-semibold text-text-primary flex-1 text-left hover:text-primary transition-colors"
              >
                {group.name}
                <span className="text-xs text-text-muted font-normal ml-1.5">↗ history</span>
              </button>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${muscleColor(group.muscleGroup)}`}>
                {group.muscleGroup}
              </span>
            </div>

            {/* Sets table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[280px]">
                <thead>
                  <tr className="text-xs text-text-muted border-b border-border">
                    <th className="text-left pb-2 w-10">Set</th>
                    <th className="text-right pb-2">Weight</th>
                    <th className="text-right pb-2">Reps</th>
                    <th className="text-right pb-2">RPE</th>
                    <th className="text-right pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {group.sets.map((s) => (
                    <tr key={s.id} className={`border-b border-border/50 last:border-0 ${!s.completed ? 'opacity-40' : ''}`}>
                      <td className="py-2 text-text-muted font-mono text-xs">{s.setNumber}</td>
                      <td className="py-2 text-right font-mono text-text-primary">
                        {s.weight != null ? `${s.weight} kg` : '—'}
                      </td>
                      <td className="py-2 text-right font-mono text-text-primary">
                        {s.reps != null ? s.reps : '—'}
                      </td>
                      <td className="py-2 text-right text-text-muted font-mono text-xs">
                        {s.rpe != null ? s.rpe : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {s.completed
                          ? <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                          : <Circle className="w-4 h-4 text-text-muted ml-auto" />
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Per-exercise volume */}
            {(() => {
              const exVol = totalVolume(group.sets)
              return exVol > 0 ? (
                <p className="text-xs text-text-muted text-right">
                  Volume: <span className="text-text-secondary font-medium">{exVol.toLocaleString()} kg</span>
                </p>
              ) : null
            })()}
          </Card>
        ))
      )}

      {historyEx && (
        <ExerciseHistoryModal
          exerciseId={historyEx.id}
          exerciseName={historyEx.name}
          muscleGroup={historyEx.muscleGroup}
          open={!!historyEx}
          onClose={() => setHistoryEx(null)}
        />
      )}
    </div>
  )
}
