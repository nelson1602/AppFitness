import { useState, useEffect, useCallback, useRef } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, CheckCircle, Dumbbell, Clock, Flame, Zap, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { SetRow } from '@/features/workouts/components/SetRow'
import { RestTimer } from '@/features/workouts/components/RestTimer'
import { ExercisePicker } from '@/features/workouts/components/ExercisePicker'
import { AchievementToast } from '@/components/ui/AchievementToast'
import { useRestTimer } from '@/features/workouts/hooks/useRestTimer'
import { fetchLog, addSet, updateSet, deleteSet, finishWorkout, fetchLastPerformance } from '@/features/workouts/api'
import type { WorkoutLog, WorkoutSet, Exercise, WorkoutSummary, LastPerformance } from '@/types/workout'

interface ExerciseGroup {
  exercise: Exercise
  sets: WorkoutSet[]
}

const buildGroups = (log: WorkoutLog): ExerciseGroup[] => {
  const routineOrder = new Map<string, number>()
  log.routine?.exercises?.forEach(re => routineOrder.set(re.exerciseId, re.order))

  const map = new Map<string, ExerciseGroup>()
  for (const s of log.sets) {
    if (!map.has(s.exerciseId)) map.set(s.exerciseId, { exercise: s.exercise, sets: [] })
    map.get(s.exerciseId)!.sets.push(s)
  }

  return [...map.entries()]
    .sort(([a], [b]) => (routineOrder.get(a) ?? 999) - (routineOrder.get(b) ?? 999))
    .map(([, g]) => g)
}

const useElapsed = (startedAt: string) => {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const update = () => setSecs(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`
}

export const ActiveWorkoutPage = () => {
  usePageTitle('Active Workout')
  const { logId } = useParams<{ logId: string }>()
  const navigate = useNavigate()
  const timer = useRestTimer(90)

  const [log,      setLog]      = useState<WorkoutLog | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishing,  setFinishing]  = useState(false)
  const [summary,    setSummary]    = useState<WorkoutSummary | null>(null)
  const [prevBests,  setPrevBests]  = useState<Record<string, LastPerformance | null>>({})
  const fetchedIds = useRef(new Set<string>())
  const elapsed = useElapsed(log?.startedAt ?? new Date().toISOString())

  const reload = useCallback(async () => {
    if (!logId) return
    setLog(await fetchLog(logId))
  }, [logId])

  useEffect(() => { reload() }, [reload])

  // Fetch previous performance for each exercise group (lazy, once per exercise)
  useEffect(() => {
    if (!log) return
    const groups = buildGroups(log)
    const missing = groups.map(g => g.exercise.id).filter(id => !fetchedIds.current.has(id))
    if (!missing.length) return
    missing.forEach(id => fetchedIds.current.add(id))
    Promise.all(missing.map(id => fetchLastPerformance(id).then(data => ({ id, data }))))
      .then(results => {
        setPrevBests(prev => {
          const next = { ...prev }
          results.forEach(({ id, data }) => { next[id] = data })
          return next
        })
      })
      .catch(() => {})
  }, [log])

  const handleAddSet = async (exerciseId: string, existingSets: WorkoutSet[]) => {
    if (!logId) return
    const newSet = await addSet(logId, {
      exerciseId,
      setNumber: existingSets.length + 1,
      completed: false,
    })
    setLog((prev) =>
      prev ? { ...prev, sets: [...prev.sets, newSet] } : prev,
    )
  }

  const handleUpdateSet = async (setId: string, data: Parameters<typeof updateSet>[1]) => {
    const updated = await updateSet(setId, data)
    if (data.completed) timer.start()
    setLog((prev) =>
      prev ? { ...prev, sets: prev.sets.map((s) => (s.id === setId ? updated : s)) } : prev,
    )
  }

  const handleDeleteSet = async (setId: string) => {
    await deleteSet(setId)
    setLog((prev) =>
      prev ? { ...prev, sets: prev.sets.filter((s) => s.id !== setId) } : prev,
    )
  }

  const handleAddExercise = async (exercise: Exercise) => {
    if (!logId) return
    const newSet = await addSet(logId, { exerciseId: exercise.id, setNumber: 1, completed: false })
    setLog((prev) =>
      prev ? { ...prev, sets: [...prev.sets, newSet] } : prev,
    )
  }

  const handleFinish = async () => {
    if (!logId || !confirm('Finish this workout?')) return
    setFinishing(true)
    try {
      const s = await finishWorkout(logId)
      setSummary(s)
    } finally {
      setFinishing(false)
    }
  }

  if (!log) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="w-6 h-6 text-primary" />
      </div>
    )
  }

  // ── Post-workout summary screen ─────────────────────────────────────────────
  if (summary) {
    const fmtVol = summary.volumeKg > 0 ? `${Math.round(summary.volumeKg).toLocaleString()} kg` : '—'
    const fmtDur = summary.durationMins >= 60
      ? `${Math.floor(summary.durationMins / 60)}h ${summary.durationMins % 60}m`
      : `${summary.durationMins}m`
    return (
      <div className="flex flex-col items-center gap-6 py-10 animate-fade-in max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-text-primary">Workout Complete!</h2>
          <p className="text-sm text-text-secondary mt-1">{log.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          {[
            { label: 'Duration',   value: fmtDur,                      icon: Clock  },
            { label: 'Volume',     value: fmtVol,                      icon: Flame  },
            { label: 'Sets done',  value: String(summary.setsCompleted), icon: Dumbbell },
            { label: 'XP earned',  value: `+${summary.xpEarned}`,      icon: Zap    },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-surface-2 rounded-xl border border-border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs">{label}</span>
              </div>
              <span className="text-lg font-bold text-text-primary">{value}</span>
            </div>
          ))}
        </div>

        {summary.prsSet > 0 && (
          <div className="flex items-center gap-2 text-sm font-semibold text-primary bg-primary/10 px-4 py-2.5 rounded-full border border-primary/20">
            <Trophy className="w-4 h-4" />
            {summary.prsSet} Personal Record{summary.prsSet > 1 ? 's' : ''} Set!
          </div>
        )}

        {summary.newAchievements?.length > 0 && (
          <div className="w-full flex flex-col gap-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider text-center">
              Achievements Unlocked
            </p>
            {summary.newAchievements.map((a) => (
              <div
                key={a.key}
                className="flex items-center gap-3 bg-surface-2 border border-primary/20 rounded-xl px-4 py-3"
              >
                <span className="text-2xl shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary">{a.name}</p>
                </div>
                <span className="text-xs font-bold text-primary shrink-0">+{a.xpReward} XP</span>
              </div>
            ))}
          </div>
        )}

        <Button className="w-full" onClick={() => navigate('/workouts')}>
          Back to Workouts
        </Button>

        {summary.newAchievements?.length > 0 && (
          <AchievementToast achievements={summary.newAchievements} />
        )}
      </div>
    )
  }

  const groups = buildGroups(log)
  const allExIds = log.sets.map((s) => s.exerciseId)

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto animate-fade-in pb-6">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-3 -mx-4 px-4 md:-mx-6 md:px-6 border-b border-border">
        <div>
          <h1 className="font-bold text-text-primary truncate">{log.name}</h1>
          <p className="text-xs text-primary font-mono">{elapsed}</p>
        </div>
        <Button size="sm" onClick={handleFinish} isLoading={finishing}>
          <CheckCircle className="w-4 h-4" /> Finish
        </Button>
      </div>

      {/* Rest timer */}
      <RestTimer timer={timer} />

      {/* Exercise groups */}
      {groups.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <Dumbbell className="w-8 h-8 text-text-muted" />
          <p className="text-sm text-text-muted">No exercises yet. Add one below.</p>
        </Card>
      )}

      {groups.map(({ exercise, sets }) => {
        const prev = prevBests[exercise.id]
        return (
        <Card key={exercise.id} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-primary">{exercise.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="default">{exercise.muscleGroup}</Badge>
                <Badge variant="default">{exercise.category}</Badge>
                {prev && (prev.reps || prev.weight) && (
                  <span className="text-xs text-text-muted">
                    prev: {prev.reps ?? '–'} × {prev.weight ?? '–'} kg
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-2 text-xs text-text-muted px-0">
            <span className="w-6 text-center">#</span>
            <span className="w-14 text-center">Reps</span>
            <span className="w-4" />
            <span className="w-16 text-center">Weight</span>
            <span className="w-4" />
            <span className="w-12 text-center">RPE</span>
          </div>

          {/* Sets */}
          <div className="flex flex-col gap-1">
            {sets
              .sort((a, b) => a.setNumber - b.setNumber)
              .map((set, i) => (
                <SetRow
                  key={set.id}
                  set={set}
                  index={i + 1}
                  onUpdate={(data) => handleUpdateSet(set.id, data)}
                  onDelete={() => handleDeleteSet(set.id)}
                />
              ))}
          </div>

          <button
            onClick={() => handleAddSet(exercise.id, sets)}
            className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors py-1"
          >
            <Plus className="w-4 h-4" /> Add set
          </button>
        </Card>
        )
      })}

      <Button variant="secondary" onClick={() => setPickerOpen(true)}>
        <Plus className="w-4 h-4" /> Add exercise
      </Button>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddExercise}
        exclude={[...new Set(allExIds)]}
      />
    </div>
  )
}
