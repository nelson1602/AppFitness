import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, GripVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ExercisePicker } from '@/features/workouts/components/ExercisePicker'
import { createRoutine, updateRoutine, fetchRoutine, setRoutineExercises } from '@/features/workouts/api'
import type { Exercise } from '@/types/workout'

interface RoutineExEntry {
  exerciseId: string
  exercise: Exercise
  order: number
  targetSets: string
  targetReps: string
  targetWeight: string
}

export const RoutineFormPage = () => {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [entries, setEntries] = useState<RoutineExEntry[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!id) return
    fetchRoutine(id).then((r) => {
      setName(r.name)
      setDescription(r.description ?? '')
      setEntries(
        r.exercises.map((re) => ({
          exerciseId: re.exercise.id,
          exercise: re.exercise,
          order: re.order,
          targetSets: re.targetSets?.toString() ?? '',
          targetReps: re.targetReps?.toString() ?? '',
          targetWeight: re.targetWeight?.toString() ?? '',
        })),
      )
      setLoading(false)
    })
  }, [id])

  const addExercise = (exercise: Exercise) => {
    setEntries((prev) => [
      ...prev,
      { exerciseId: exercise.id, exercise, order: prev.length, targetSets: '', targetReps: '', targetWeight: '' },
    ])
  }

  const removeExercise = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx).map((e, i) => ({ ...e, order: i })))
  }

  const updateEntry = (idx: number, field: keyof Pick<RoutineExEntry, 'targetSets' | 'targetReps' | 'targetWeight'>, value: string) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const routine = isEdit
        ? await updateRoutine(id!, { name, description: description || undefined })
        : await createRoutine({ name, description: description || undefined })

      await setRoutineExercises(
        routine.id,
        entries.map((e, i) => ({
          exerciseId: e.exerciseId,
          order: i,
          targetSets: e.targetSets ? Number(e.targetSets) : null,
          targetReps: e.targetReps ? Number(e.targetReps) : null,
          targetWeight: e.targetWeight ? Number(e.targetWeight) : null,
        })),
      )
      navigate('/workouts')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{isEdit ? 'Edit Routine' : 'New Routine'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Push Day A"
            required
          />
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Upper body push focus"
          />
        </Card>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text-primary">Exercises</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>

          {entries.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-text-muted text-sm">No exercises added yet</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
                <Plus className="w-4 h-4" /> Add your first exercise
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((entry, idx) => (
                <Card key={entry.exerciseId + idx} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{entry.exercise.name}</p>
                      <Badge variant="default" className="mt-0.5">{entry.exercise.muscleGroup}</Badge>
                    </div>
                    <button type="button" onClick={() => removeExercise(idx)} className="text-text-muted hover:text-error transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {(['targetSets', 'targetReps', 'targetWeight'] as const).map((field) => (
                      <div key={field} className="flex-1">
                        <input
                          type="number"
                          value={entry[field]}
                          onChange={(e) => updateEntry(idx, field, e.target.value)}
                          placeholder="–"
                          min={0}
                          className="w-full h-8 rounded bg-surface-2 border border-border text-center text-xs text-text-primary focus:outline-none focus:border-primary transition-colors"
                        />
                        <p className="text-center text-xs text-text-muted mt-0.5">
                          {field === 'targetSets' ? 'Sets' : field === 'targetReps' ? 'Reps' : 'kg'}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate('/workouts')}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" isLoading={saving}>
            {isEdit ? 'Save changes' : 'Create routine'}
          </Button>
        </div>
      </form>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addExercise}
        exclude={entries.map((e) => e.exerciseId)}
      />
    </div>
  )
}
