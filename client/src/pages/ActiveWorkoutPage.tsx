import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, CheckCircle, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { SetRow } from '@/features/workouts/components/SetRow'
import { RestTimer } from '@/features/workouts/components/RestTimer'
import { ExercisePicker } from '@/features/workouts/components/ExercisePicker'
import { useRestTimer } from '@/features/workouts/hooks/useRestTimer'
import { fetchLog, addSet, updateSet, deleteSet, finishWorkout } from '@/features/workouts/api'
import type { WorkoutLog, WorkoutSet, Exercise } from '@/types/workout'

interface ExerciseGroup {
  exercise: Exercise
  sets: WorkoutSet[]
}

const buildGroups = (log: WorkoutLog): ExerciseGroup[] => {
  const order: string[] = []
  const map = new Map<string, ExerciseGroup>()

  // keep routine order first
  log.routine && log.sets.forEach((s) => {
    if (!map.has(s.exerciseId)) {
      order.push(s.exerciseId)
      map.set(s.exerciseId, { exercise: s.exercise, sets: [] })
    }
    map.get(s.exerciseId)!.sets.push(s)
  })

  // Also handle sets without a routine
  log.sets.forEach((s) => {
    if (!map.has(s.exerciseId)) {
      order.push(s.exerciseId)
      map.set(s.exerciseId, { exercise: s.exercise, sets: [] })
    }
    if (!map.get(s.exerciseId)!.sets.find((x) => x.id === s.id)) {
      map.get(s.exerciseId)!.sets.push(s)
    }
  })

  return order.map((id) => map.get(id)!).filter(Boolean)
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
  const { logId } = useParams<{ logId: string }>()
  const navigate = useNavigate()
  const timer = useRestTimer(90)

  const [log, setLog] = useState<WorkoutLog | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const elapsed = useElapsed(log?.startedAt ?? new Date().toISOString())

  const reload = useCallback(async () => {
    if (!logId) return
    setLog(await fetchLog(logId))
  }, [logId])

  useEffect(() => { reload() }, [reload])

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
    await finishWorkout(logId)
    navigate('/workouts')
  }

  if (!log) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="w-6 h-6 text-primary" />
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

      {groups.map(({ exercise, sets }) => (
        <Card key={exercise.id} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-primary">{exercise.name}</p>
              <div className="flex gap-2 mt-0.5">
                <Badge variant="default">{exercise.muscleGroup}</Badge>
                <Badge variant="default">{exercise.category}</Badge>
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
      ))}

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
